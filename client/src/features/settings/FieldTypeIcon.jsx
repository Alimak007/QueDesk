import { AlignLeft, AtSign, Calendar, Hash, Link, ListChecks, Phone, SquareCheck, Type, Wallet } from 'lucide-react';

const ICONS = {
  text: Type,
  textarea: AlignLeft,
  number: Hash,
  currency: Wallet,
  email: AtSign,
  phone: Phone,
  url: Link,
  date: Calendar,
  dropdown: ListChecks,
  checkbox: SquareCheck,
};

export function FieldTypeIcon({ type, size = 16, className }) {
  const Icon = ICONS[type] ?? Type;
  return <Icon size={size} className={className} aria-hidden />;
}
