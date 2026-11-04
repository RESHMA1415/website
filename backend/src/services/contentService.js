import { Banner, Product, SizeChart } from '../models/index.js';
import { HttpError } from '../utils/asyncHandler.js';
import { cleanLink, cleanMediaUrl, cleanText, isObjectId, pageParams, requireObjectId, requireText } from '../utils/text.js';

// Homepage banners (PRD §14.4) and size charts (PRD §5.3)

function toDate(value, label) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `Please enter a valid ${label}.`);
  return date;
}

export async function listBannersForAdmin(query = {}) {
  const { page, limit, skip } = pageParams(query, { defaultLimit: 50, maxLimit: 100 });
  const [items, total] = await Promise.all([
    Banner.find().sort({ displayOrder: 1, createdAt: 1 }).skip(skip).limit(limit).lean(),
    Banner.countDocuments(),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function saveBanner(id, body) {
  const activeFrom = toDate(body.activeFrom, 'start date');
  const activeTo = toDate(body.activeTo, 'end date');
  if (activeFrom && activeTo && activeTo < activeFrom) {
    throw new HttpError(400, 'The end date must be after the start date.');
  }
  const fields = {
    heading: requireText(body.heading, 'banner heading', 80),
    subHeading: cleanText(body.subHeading, 160),
    buttonText: cleanText(body.buttonText, 30),
    buttonLink: cleanLink(body.buttonLink),
    desktopImageUrl: cleanMediaUrl(body.desktopImageUrl),
    mobileImageUrl: cleanMediaUrl(body.mobileImageUrl),
    activeFrom,
    activeTo,
    status: body.status === 'hidden' ? 'hidden' : 'active',
  };
  if (fields.buttonText && !fields.buttonLink) throw new HttpError(400, 'Please add the page the button should open.');

  if (!id) {
    const last = await Banner.findOne().sort({ displayOrder: -1 }).lean();
    return Banner.create({ ...fields, displayOrder: (last?.displayOrder || 0) + 1 });
  }
  const banner = await Banner.findByIdAndUpdate(requireObjectId(id, 'We couldn’t find that banner.'), fields, { new: true });
  if (!banner) throw new HttpError(404, 'We couldn’t find that banner.');
  return banner;
}

export async function reorderBanners(ids) {
  if (!Array.isArray(ids) || !ids.length || !ids.every(isObjectId)) throw new HttpError(400, 'Please try moving the banner again.');
  // The list may be one page, so reuse the positions those banners already
  // hold (in order) instead of renumbering from 1 and clashing with other pages
  const current = await Banner.find({ _id: { $in: ids } }, { displayOrder: 1 }).lean();
  if (current.length !== ids.length) throw new HttpError(400, 'Please reload the page and try moving the banner again.');
  const slots = current.map((b) => b.displayOrder || 0).sort((a, b) => a - b);
  for (let i = 1; i < slots.length; i += 1) if (slots[i] <= slots[i - 1]) slots[i] = slots[i - 1] + 1;
  await Banner.bulkWrite(ids.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { displayOrder: slots[index] } } })));
  return { ok: true };
}

export async function deleteBanner(id) {
  const result = await Banner.deleteOne({ _id: requireObjectId(id, 'We couldn’t find that banner.') });
  if (!result.deletedCount) throw new HttpError(404, 'We couldn’t find that banner.');
}

const CHART_TYPES = ['men_clothing', 'women_clothing', 'footwear', 'other'];

export async function listSizeCharts(query = {}) {
  const { page, limit, skip } = pageParams(query, { defaultLimit: 50, maxLimit: 200 });
  const [charts, total] = await Promise.all([
    SizeChart.find().sort({ name: 1, _id: 1 }).skip(skip).limit(limit).lean(),
    SizeChart.countDocuments(),
  ]);
  const usage = await Product.aggregate([
    { $match: { sizeChart: { $in: charts.map((c) => c._id) } } },
    { $group: { _id: '$sizeChart', count: { $sum: 1 } } },
  ]);
  const byId = new Map(usage.map((u) => [String(u._id), u.count]));
  const items = charts.map((c) => ({ ...c, productCount: byId.get(String(c._id)) || 0 }));
  return { items, total, page, pages: Math.ceil(total / limit) };
}

export async function saveSizeChart(id, body) {
  const columns = (Array.isArray(body.columns) ? body.columns : []).map((c) => cleanText(c, 30)).slice(0, 10);
  const rows = (Array.isArray(body.rows) ? body.rows : [])
    .slice(0, 40)
    .map((row) => columns.map((_, i) => cleanText(Array.isArray(row) ? row[i] : '', 30)))
    .filter((row) => row.some(Boolean));
  const imageUrl = cleanMediaUrl(body.imageUrl);
  if (!imageUrl && (!columns.filter(Boolean).length || !rows.length)) {
    throw new HttpError(400, 'Add a size table (headings and at least one row) or a size chart photo.');
  }
  const type = CHART_TYPES.includes(body.type) ? body.type : 'other';
  const fields = { name: requireText(body.name, 'size chart name', 60), type, imageUrl, columns, rows };
  if (!id) return SizeChart.create(fields);
  const chart = await SizeChart.findByIdAndUpdate(requireObjectId(id, 'We couldn’t find that size chart.'), fields, { new: true });
  if (!chart) throw new HttpError(404, 'We couldn’t find that size chart.');
  return chart;
}

// Products using a deleted chart simply stop showing the size chart link
export async function deleteSizeChart(id) {
  const chartId = requireObjectId(id, 'We couldn’t find that size chart.');
  const result = await SizeChart.deleteOne({ _id: chartId });
  if (!result.deletedCount) throw new HttpError(404, 'We couldn’t find that size chart.');
  const { modifiedCount } = await Product.updateMany({ sizeChart: chartId }, { sizeChart: null });
  return { productsUpdated: modifiedCount };
}
