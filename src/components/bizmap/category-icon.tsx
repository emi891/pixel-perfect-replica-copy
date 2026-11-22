import { Car, Coffee, Croissant, Dumbbell, Scissors, Shirt, ShoppingBasket, Sparkles, UtensilsCrossed, Wrench, type LucideIcon } from "lucide-react";
import type { CategoryId } from "@/lib/categories";

const ICONS: Record<CategoryId, LucideIcon> = {
  bakery: Croissant,
  cafe: Coffee,
  restaurant: UtensilsCrossed,
  barbershop: Scissors,
  hair_salon: Sparkles,
  gym: Dumbbell,
  grocery: ShoppingBasket,
  clothing: Shirt,
  car_repair: Wrench,
  car_detailing: Car,
};

export function CategoryIcon({ id, className }: { id: CategoryId; className?: string }) {
  const Icon = ICONS[id];
  return <Icon className={className} aria-hidden />;
}
