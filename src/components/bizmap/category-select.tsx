import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORY_LIST, isCategoryId, type CategoryId } from "@/lib/categories";
import { CategoryIcon } from "./category-icon";
import { cn } from "@/lib/utils";

export function CategorySelect({
  value,
  onChange,
  className,
}: {
  value: CategoryId;
  onChange: (id: CategoryId) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => isCategoryId(v) && onChange(v)}>
      <SelectTrigger className={cn("h-11 bg-surface", className)} aria-label="Business category">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CATEGORY_LIST.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span className="flex items-center gap-2">
              <CategoryIcon id={c.id} className="size-4 text-primary" />
              {c.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
