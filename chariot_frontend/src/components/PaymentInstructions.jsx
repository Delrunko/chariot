import { useState } from "react";
import "./PaymentInstructions.css";

const ACCOUNT_NAME = "DOMBOU TAMU Fernando Jordan";

const PROVIDERS = [
  {
    key: "orange",
    label: "Orange Money",
    number: "656877046",
  },
  {
    key: "mtn",
    label: "MTN Mobile Money",
    number: "672512705",
  },
];

export default function PaymentInstructions({ amount }) {
  const [copiedKey, setCopiedKey] = useState(null);
  const [copyError, setCopyError] = useState("");

  const copyNumber = async (provider) => {
    try {
      await navigator.clipboard.writeText(provider.number);
      setCopiedKey(provider.key);
      setCopyError("");
      window.setTimeout(() => setCopiedKey(null), 2200);
    } catch (error) {
      console.error(`Impossible de copier le numéro ${provider.label}.`, error);
      setCopyError("Copie impossible. Sélectionnez et copiez le numéro manuellement.");
    }
  };

  return (
    <section className="payment-instructions" aria-live="polite">
      <div className="admin-alert admin-alert-warning" style={{ marginBottom: 12 }}>
        NB: évitez de valider la transaction si ce n'est pas le nom ci-dessous qui s'affiche{" "}
        <strong>{ACCOUNT_NAME}</strong>
      </div>

      <p className="payment-instructions-label">Paiement par dépôt Orange Money ou MTN Mobile Money</p>
      <p className="payment-instructions-copy">
        Depuis votre téléphone, effectuez un dépôt à l'un des numéros de l'administrateur ci-dessous,
        du montant exact de votre commande. Votre accès sera activé après vérification du paiement.
      </p>

      {PROVIDERS.map((provider) => {
        const inputId = `payment-deposit-number-${provider.key}`;
        const copied = copiedKey === provider.key;

        return (
          <div className="payment-instructions-number-row" key={provider.key}>
            <label htmlFor={inputId}>
              {provider.label} — {ACCOUNT_NAME}
            </label>
            <div className="payment-instructions-number">
              <input
                id={inputId}
                type="tel"
                value={provider.number}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
                aria-label={`Numéro ${provider.label} de l'administrateur pour effectuer le dépôt`}
              />
              <button
                type="button"
                className="btn-outline"
                onClick={() => copyNumber(provider)}
              >
                <i className={`fas ${copied ? "fa-check" : "fa-copy"}`} aria-hidden="true" />
                {copied ? "Numéro copié" : "Copier le numéro"}
              </button>
            </div>
          </div>
        );
      })}

      <div className="payment-instructions-amount">
        Montant à déposer : <strong>{Number(amount || 0).toLocaleString("fr-FR")} FCFA</strong>
      </div>
      {copyError && <p className="payment-instructions-error" role="alert">{copyError}</p>}
    </section>
  );
}