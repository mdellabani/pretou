import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useQuery } from "@tanstack/react-query";
import { renderWithQuery } from "./render-with-query";

function PostsBadge() {
  const { data } = useQuery<string[]>({
    queryKey: ["posts", "c1"],
    queryFn: async () => ["should-not-run"],
  });
  return <div>{(data ?? []).join(",")}</div>;
}

describe("renderWithQuery", () => {
  it("pre-seeds the cache so useQuery reads data synchronously without fetching", () => {
    renderWithQuery(<PostsBadge />, {
      cache: [{ key: ["posts", "c1"], data: ["hello", "world"] }],
    });
    expect(screen.getByText("hello,world")).toBeInTheDocument();
  });

  it("renders without any seeded data when cache is omitted", () => {
    renderWithQuery(<div data-testid="plain">ok</div>);
    expect(screen.getByTestId("plain")).toBeInTheDocument();
  });
});
