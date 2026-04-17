import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListSkeleton } from "@/components/skeletons/list-skeleton";

describe("ListSkeleton", () => {
  it("renders the requested number of placeholder rows", () => {
    const { container } = render(<ListSkeleton rows={5} />);
    const rows = container.querySelectorAll("[data-testid='list-skeleton-row']");
    expect(rows).toHaveLength(5);
  });

  it("defaults to 3 rows when rows prop is omitted", () => {
    const { container } = render(<ListSkeleton />);
    const rows = container.querySelectorAll("[data-testid='list-skeleton-row']");
    expect(rows).toHaveLength(3);
  });
});
