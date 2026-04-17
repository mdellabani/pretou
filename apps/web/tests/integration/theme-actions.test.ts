import { beforeEach, describe, expect, it } from "vitest";
import {
  resetData,
  signInAs,
  getCommune,
  SEED_IDS,
  SEED_EMAILS,
} from "./_fixtures";

describe("communes update — theme-actions equivalent", () => {
  beforeEach(async () => {
    await resetData();
  });

  it("admin updates own commune theme + custom color", async () => {
    const { supabase } = await signInAs(SEED_EMAILS.admin);
    const { error } = await supabase
      .from("communes")
      .update({ theme: "alpin", custom_primary_color: "#3B82F6" })
      .eq("id", SEED_IDS.commune);
    expect(error).toBeNull();
    const after = await getCommune(SEED_IDS.commune);
    expect(after?.theme).toBe("alpin");
    expect(after?.custom_primary_color).toBe("#3B82F6");
  });

  it("admin clears logo_url to null", async () => {
    const { supabase } = await signInAs(SEED_EMAILS.admin);
    // Seed it first via service.
    const before = await getCommune(SEED_IDS.commune);
    expect(before).toBeTruthy();
    const { error } = await supabase
      .from("communes")
      .update({ logo_url: null })
      .eq("id", SEED_IDS.commune);
    expect(error).toBeNull();
    const after = await getCommune(SEED_IDS.commune);
    expect(after?.logo_url).toBeNull();
  });

  it("moderator update is silently blocked (no rows affected)", async () => {
    const { supabase } = await signInAs(SEED_EMAILS.moderator);
    const { error } = await supabase
      .from("communes")
      .update({ theme: "alpin" })
      .eq("id", SEED_IDS.commune);
    expect(error).toBeNull();
    const after = await getCommune(SEED_IDS.commune);
    expect(after?.theme).toBe("terre_doc"); // unchanged
  });

  it("resident update is silently blocked", async () => {
    const { supabase } = await signInAs(SEED_EMAILS.resident);
    await supabase
      .from("communes")
      .update({ theme: "alpin" })
      .eq("id", SEED_IDS.commune);
    const after = await getCommune(SEED_IDS.commune);
    expect(after?.theme).toBe("terre_doc");
  });
});
