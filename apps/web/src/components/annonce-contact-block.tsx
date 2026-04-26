type Props = { phone: string | null; email: string | null; openingHours: string | null };

export function AnnonceContactBlock({ phone, email, openingHours }: Props) {
  if (!phone && !email && !openingHours) return null;
  return (
    <ul className="mt-3 space-y-1 rounded-md border border-[#f0e0d0] bg-[#FDF0EB] px-3 py-2 text-sm">
      {phone && (
        <li>
          📞{" "}
          <a
            href={`tel:${phone.replace(/\s|\./g, "")}`}
            className="text-[#BF3328] underline"
          >
            {phone}
          </a>
        </li>
      )}
      {email && (
        <li>
          ✉️{" "}
          <a href={`mailto:${email}`} className="text-[#BF3328] underline">
            {email}
          </a>
        </li>
      )}
      {openingHours && <li>🕒 {openingHours}</li>}
    </ul>
  );
}
