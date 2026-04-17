import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { FeedFilters } from "@/components/feed-filters";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/app/feed",
  useSearchParams: () => new URLSearchParams(""),
}));

describe("FeedFilters", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("does not show an active-count badge with no filters", () => {
    render(<FeedFilters types={[]} date="" />);
    // Filter button text doesn't include a count.
    expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument();
  });

  it("shows active-count badge equal to types + date + communes selected", () => {
    render(<FeedFilters types={["annonce", "evenement"]} date="week" selectedCommunes={["c1"]} />);
    expect(screen.getByText("Filtres (4)")).toBeInTheDocument();
  });

  it("opens the panel when the filter button is clicked", () => {
    render(<FeedFilters types={[]} date="" />);
    const trigger = screen.getByRole("button", { name: /Filtres/ });
    fireEvent.click(trigger);
    expect(screen.getByText("Aujourd'hui")).toBeInTheDocument();
  });

  it("pushes a URL containing the toggled type when a type chip is clicked", () => {
    render(<FeedFilters types={[]} date="" />);
    const trigger = screen.getByRole("button", { name: /Filtres/ });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText("Annonce officielle"));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toContain("types=annonce");
  });

  it("pushes a URL with the chosen date filter", () => {
    render(<FeedFilters types={[]} date="" />);
    const trigger = screen.getByRole("button", { name: /Filtres/ });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText("Semaine"));
    expect(push.mock.calls[0][0]).toContain("date=week");
  });
});
