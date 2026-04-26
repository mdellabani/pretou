import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContacterButton } from "@/components/contacter-button";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/app/messages/actions", () => ({
  startConversationAction: vi.fn(async () => ({ id: "c1", created: true })),
}));

describe("ContacterButton", () => {
  it("renders for entraide post when viewer is not the author", () => {
    render(<ContacterButton postId="p1" postType="entraide" authorId="other" viewerId="me" />);
    expect(screen.getByRole("button", { name: /contacter/i })).toBeInTheDocument();
  });

  it("hides for annonce", () => {
    const { container } = render(
      <ContacterButton postId="p1" postType="annonce" authorId="other" viewerId="me" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("hides when viewer is the author", () => {
    const { container } = render(
      <ContacterButton postId="p1" postType="entraide" authorId="me" viewerId="me" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
