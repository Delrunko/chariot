/**
 * Construit un lien "cliquer pour discuter" WhatsApp adapté à l'appareil
 * du visiteur.
 *
 * - Sur mobile : utilise wa.me, qui ouvre directement l'app WhatsApp
 *   sur la bonne conversation, sans souci.
 * - Sur PC (desktop) : utilise api.whatsapp.com, qui reste dans le
 *   navigateur et évite le sélecteur d'application de Windows déclenché
 *   par les liens wa.me quand WhatsApp Desktop est installé — l'app
 *   Desktop ne charge pas toujours correctement la conversation avec le
 *   message pré-rempli, ce qui donne l'impression que "ça n'ouvre que
 *   WhatsApp sans lancer la discussion".
 *
 * Sur PC, un clic supplémentaire ("Continuer vers WhatsApp Web") reste
 * possible : c'est imposé par WhatsApp lui-même, aucun site ne peut le
 * supprimer complètement.
 */
export function buildWhatsAppLink(numero, texte) {
  const numeroPropre = String(numero || "").replace(/[^0-9]/g, "");
  const texteEncode = encodeURIComponent(texte || "");

  const estMobile =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");

  if (estMobile) {
    return `https://wa.me/${numeroPropre}?text=${texteEncode}`;
  }
  return `https://api.whatsapp.com/send?phone=${numeroPropre}&text=${texteEncode}`;
}