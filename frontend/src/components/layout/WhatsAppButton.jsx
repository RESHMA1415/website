import { useStore } from '../../context/StoreContext.jsx';
import { generalWhatsappMessage, whatsappLink } from '../../utils/format.js';

// Floating enquiry button (PRD §12.1). Product pages set a product-specific message.
export default function WhatsAppButton() {
  const { settings, whatsappMessage } = useStore();
  const number = settings.store.whatsappNumber;
  if (!number) return null;
  const message = whatsappMessage || generalWhatsappMessage(settings.store.name);
  return (
    <a
      href={whatsappLink(number, message)}
      className="whatsapp-fab"
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with us on WhatsApp"
    >
      <i className="bi bi-whatsapp" />
    </a>
  );
}
