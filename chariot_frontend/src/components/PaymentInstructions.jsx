import { useState } from "react";
import "./PaymentInstructions.css";

const DEPOSIT_NUMBER = "656877046";

export default function PaymentInstructions({
  amount,
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(DEPOSIT_NUMBER);
      setCopied(true);
      setCopyError("");
      window.setTimeout(() => setCopied(false), 2200);
    } catch (error) {
      console.error("Impossible de copier le numéro de dépôt.", error);
      setCopyError("Copie impossible. Sélectionnez et copiez le numéro manuellement.");
    }
  };

  return (
    <section className="payment-instructions" aria-live="polite">
      <div className="admin-alert admin-alert-warning" style={{ marginBottom: 12 }}>
        NB: évitez de valider la transaction si ce n'est pas le nom ci-dessous qui s'affiche <strong>DOMBOU TAMU Fernando Jordan</strong>
      </div>

      <p className="payment-instructions-label">Paiement par dépôt Orange Money</p>
      <p className="payment-instructions-copy">
        Depuis votre téléphone, effectuez un dépôt au numéro de l'administrateur ci-dessous,
        du montant exact de votre commande. Votre accès sera activé après vérification du paiement.
      </p>
      <div className="payment-instructions-number-row">
        <label htmlFor="payment-deposit-number">Numéro Orange Money de l'administrateur</label>
        <div className="payment-instructions-number">
          <input
            id="payment-deposit-number"
            type="tel"
            value={DEPOSIT_NUMBER}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
            aria-label="Numéro Orange Money de l'administrateur pour effectuer le dépôt"
          />
          <button type="button" className="btn-outline" onClick={copyNumber}>
            <i className={`fas ${copied ? "fa-check" : "fa-copy"}`} aria-hidden="true" />
            {copied ? "Numéro copié" : "Copier le numéro"}
          </button>
        </div>
      </div>
      <div className="payment-instructions-amount">
        Montant à déposer : <strong>{Number(amount || 0).toLocaleString("fr-FR")} FCFA</strong>
      </div>
      {copyError && <p className="payment-instructions-error" role="alert">{copyError}</p>}
    </section>
  );
}