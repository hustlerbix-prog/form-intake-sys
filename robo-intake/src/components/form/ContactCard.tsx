import { useMemo, useState } from "react";

export function ContactCard(props: {
  language: "en" | "es";
  onSubmit: (input: { email: string; first_name: string; consent_marketing: boolean }) => void;
  onBack?: () => void;
  variant?: "final" | "optional";
}) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [consent, setConsent] = useState(false);

  const canSubmit = useMemo(() => email.trim().length > 3 && firstName.trim().length > 0, [email, firstName]);
  const isEs = props.language === "es";
  const isOptional = props.variant === "optional";

  return (
    <div className="bg-navy-800 border border-navy-600 rounded-xl p-6">
      <h2 className="font-syne text-xl font-bold text-white">
        {isOptional
          ? isEs
            ? "Opcional — ¿a qué correo enviamos tu reporte?"
            : "Optional — where should we email your report?"
          : isEs
            ? "Último paso — ¿dónde enviamos tu reporte?"
            : "Last step — where should we send your report?"}
      </h2>
      <div className="mt-5 grid gap-4">
        <label className="grid gap-1">
          <span className="text-sm text-slateText">{isEs ? "Tu nombre" : "Your first name"}</span>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="h-11 rounded-lg bg-navy border border-navy-600 px-4 text-white focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-slateText">{isEs ? "Tu correo electrónico" : "Your email address"}</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            className="h-11 rounded-lg bg-navy border border-navy-600 px-4 text-white focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
        </label>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm text-slateText leading-6">
            {isEs
              ? "Acepto recibir comunicaciones de marketing de ROBO AI Agency"
              : "I agree to receive marketing communications from ROBO AI Agency"}
          </span>
        </label>

        <div className="mt-2 flex flex-col sm:flex-row gap-3">
          {props.onBack ? (
            <button
              type="button"
              onClick={props.onBack}
              className="h-11 rounded-lg border border-navy-600 text-white font-semibold px-5 hover:bg-navy transition"
            >
              {isEs ? "Atrás" : "Back"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              if (!canSubmit) return;
              props.onSubmit({
                email: email.trim(),
                first_name: firstName.trim(),
                consent_marketing: consent,
              });
            }}
            className={
              "h-11 rounded-lg font-bold px-6 transition " +
              (canSubmit
                ? "bg-teal text-navy hover:brightness-110"
                : "bg-navy-600 text-slateText cursor-not-allowed")
            }
          >
            {isOptional ? (isEs ? "Enviarme el reporte" : "Email me the report") : isEs ? "Obtener mi análisis gratuito" : "Get my free analysis"}
          </button>
        </div>
      </div>
    </div>
  );
}
