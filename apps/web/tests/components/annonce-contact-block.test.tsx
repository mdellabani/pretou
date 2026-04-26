import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnnonceContactBlock } from "@/components/annonce-contact-block";

describe("AnnonceContactBlock", () => {
  it("renders phone first, then email, then hours", () => {
    render(
      <AnnonceContactBlock
        phone="05.59.01.02.03"
        email="contact@example.fr"
        openingHours="Mardi & jeudi, 9h-12h"
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("05.59.01.02.03");
    expect(items[1]).toHaveTextContent("contact@example.fr");
    expect(items[2]).toHaveTextContent("Mardi & jeudi, 9h-12h");
  });

  it("hides null lines", () => {
    render(<AnnonceContactBlock phone="05.59.01.02.03" email={null} openingHours={null} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("returns null when all fields are null", () => {
    const { container } = render(
      <AnnonceContactBlock phone={null} email={null} openingHours={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("phone uses tel: link", () => {
    render(<AnnonceContactBlock phone="0559010203" email={null} openingHours={null} />);
    expect(screen.getByRole("link", { name: /05/ })).toHaveAttribute("href", "tel:0559010203");
  });

  it("email uses mailto: link", () => {
    render(<AnnonceContactBlock phone={null} email="x@y.fr" openingHours={null} />);
    expect(screen.getByRole("link", { name: /x@y\.fr/ })).toHaveAttribute("href", "mailto:x@y.fr");
  });
});
