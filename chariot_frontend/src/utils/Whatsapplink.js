// chariot_frontend/src/utils/whatsappLink.js

/**
 * Construit un lien WhatsApp propre.
 */
export function buildWhatsAppLink(phoneNumber, message = "") {
  if (!phoneNumber) return "";

  // Nettoyer le numéro (garder seulement les chiffres)
  let cleanPhone = String(phoneNumber).replace(/\D/g, '');

  // Préfixe Cameroun si nécessaire (ajustez selon votre logique métier réelle)
  // Exemple simple : si ça commence par 6 et fait 9 chiffres -> ajouter 237
  if (cleanPhone.length === 9 && cleanPhone.startsWith('6')) {
    cleanPhone = '237' + cleanPhone;
  } else if (!cleanPhone.startsWith('+') && !cleanPhone.startsWith('237')) {
     // Sécurité supplémentaire si format inconnu
     cleanPhone = '+' + cleanPhone; 
  }

  const encodedMessage = encodeURIComponent(message);
  
  // Retourne juste l'URL string standard
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}