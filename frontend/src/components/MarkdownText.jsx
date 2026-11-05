import { Fragment } from 'react';
import { Link } from 'react-router-dom';

// A small, safe Markdown renderer for the policy pages (headings, paragraphs,
// lists, tables, **bold** and [links](/path)). It builds React elements, so
// page text can never inject HTML or scripts.

const BLOCK_START = /^(#{1,3}\s|\||\d+\.\s|-\s)/;

function inline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g);
  return parts.map((part, i) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={i}>{bold[1]}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      const [, label, href] = link;
      if (href.startsWith('/')) return <Link key={i} to={href}>{label}</Link>;
      if (/^https?:\/\//.test(href)) return <a key={i} href={href} target="_blank" rel="noopener noreferrer">{label}</a>;
      return <Fragment key={i}>{label}</Fragment>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

function parse(lines) {
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }

    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const [head, , ...body] = rows; // second row is the |---| separator
      blocks.push({ type: 'table', head: cells(head), rows: body.map(cells) });
      continue;
    }

    const listMatch = line.match(/^(\d+\.|-)\s+(.*)$/);
    if (listMatch) {
      const ordered = listMatch[1] !== '-';
      const items = [];
      while (i < lines.length) {
        const current = lines[i];
        const item = current.match(/^(\d+\.|-)\s+(.*)$/);
        if (item && (item[1] !== '-') === ordered) {
          items.push({ text: item[2], children: [] });
          i += 1;
        } else if (/^\s{2,}\S/.test(current) && items.length) {
          items[items.length - 1].children.push(current.replace(/^\s{2,3}/, ''));
          i += 1;
        } else if (!current.trim()) {
          // A blank line continues the list only if indented text follows
          let j = i + 1;
          while (j < lines.length && !lines[j].trim()) j += 1;
          if (j < lines.length && /^\s{2,}\S/.test(lines[j]) && items.length) {
            items[items.length - 1].children.push('');
            i = j;
          } else break;
        } else break;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) paragraph.push(lines[i++].trim());
    blocks.push({ type: 'paragraph', lines: paragraph });
  }
  return blocks;
}

function Blocks({ blocks }) {
  return blocks.map((block, i) => {
    if (block.type === 'heading') {
      const Tag = block.level === 1 ? 'h2' : block.level === 2 ? 'h2' : 'h3';
      return <Tag key={i} className={block.level === 3 ? 'policy-h3' : 'policy-h2'}>{inline(block.text)}</Tag>;
    }
    if (block.type === 'table') {
      return (
        <div key={i} className="table-responsive mb-3">
          <table className="table table-sm table-bordered align-top mb-0 policy-table">
            <thead className="table-light"><tr>{block.head.map((c, j) => <th key={j} scope="col">{inline(c)}</th>)}</tr></thead>
            <tbody>{block.rows.map((row, r) => <tr key={r}>{row.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    }
    if (block.type === 'list') {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag key={i} className="mb-3">
          {block.items.map((item, j) => (
            <li key={j}>
              {inline(item.text)}
              {item.children.length > 0 && <Blocks blocks={parse(item.children)} />}
            </li>
          ))}
        </Tag>
      );
    }
    return (
      <p key={i}>
        {block.lines.map((l, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(l)}
          </Fragment>
        ))}
      </p>
    );
  });
}

// `skipTitle` hides the document's own "# Title" when the page header already shows it
export default function MarkdownText({ text = '', skipTitle = false }) {
  let blocks = parse(String(text).replace(/\r\n/g, '\n').split('\n'));
  if (skipTitle && blocks[0]?.type === 'heading' && blocks[0].level === 1) blocks = blocks.slice(1);
  return <div className="policy-content"><Blocks blocks={blocks} /></div>;
}
