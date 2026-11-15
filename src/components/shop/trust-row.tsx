import { BadgeCheck, PhoneCall, RotateCcw, ShieldCheck } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";

export function TrustRow({ dict }: { dict: Dictionary }) {
  const items = [
    { icon: BadgeCheck, title: dict.trust.genuineTitle, text: dict.trust.genuineText },
    { icon: ShieldCheck, title: dict.trust.warrantyTitle, text: dict.trust.warrantyText },
    { icon: RotateCcw, title: dict.trust.returnsTitle, text: dict.trust.returnsText },
    { icon: PhoneCall, title: dict.trust.contactTitle, text: dict.trust.contactText },
  ];
  return (
    <ul role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ icon: Icon, title, text }) => (
        <li
          key={title}
          className="reveal rounded-md bg-surface p-6 shadow-soft transition-transform duration-500 ease-soft hover:-translate-y-1"
        >
          <span className="mb-4 grid size-11 place-items-center rounded-sm bg-gradient-to-br from-gold-light to-gold text-accent-foreground">
            <Icon className="size-5" aria-hidden />
          </span>
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{text}</p>
        </li>
      ))}
    </ul>
  );
}
