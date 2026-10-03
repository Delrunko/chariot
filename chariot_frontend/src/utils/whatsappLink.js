/**
 * Génère un lien WhatsApp cliquable à partir d'un numéro et d'un message.
 * Les numéros internationaux sont conservés; les numéros locaux commençant
 * par 0 sont interprétés comme béninois.
 */
export const whatsappLink = (phone, message = "") => {
  if (!phone) return "#";

  let digits = String(phone).replace(/\D/g, "");
  if (!digits) return "#";

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = `229${digits.slice(1)}`;
  } else if (digits.length === 9 && digits.startsWith("6")) {
    digits = `237${digits}`;
  }

  const text = encodeURIComponent(message);
  return `https://wa.me/${digits}${text ? `?text=${text}` : ""}`;
};

export const buildWhatsAppLink = whatsappLink;
export default whatsappLink;