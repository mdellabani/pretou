import { beforeEach, describe, expect, it } from "vitest";
import {
  resetData,
  signInAs,
  getCommune,
  SEED_IDS,
  SEED_EMAILS,
} from "./_fixtures";

describe("commune info update — contact, opening_hours, associations RLS", () => {
  beforeEach(async () => {
    await resetData();
  });

  it("admin updates address, phone, email", async () => {
    const { supabase } = await signInAs(SEED_EMAILS.admin);
    const { error } = await supabase
      .from("communes")
      .update({
        address: "1 Rue Test",
        phone: "0501020304",
        email: "test@example.fr",
      })
      .eq("id", SEED_IDS.commune);
    expect(error).toBeNull();
    const after = await getCommune(SEED_IDS.commune);
    expect(after?.address).toBe("1 Rue Test");
    expect(after?.phone).toBe("0501020304");
    expect(after?.email).toBe("test@example.fr");
  });

  it("admin updates opening_hours JSON", async () => {
    const { supabase } = await signInAs(SEED_EMAILS.admin);
    const hours = { lundi: "9h-12h", mardi: "fermé" };
    const { error } = await supabase
      .from("communes")
      .update({ opening_hours: hours })
      .eq("id", SEED_IDS.commune);
    expect(error).toBeNull();
    const after = await getCommune(SEED_IDS.commune);
    expect(after?.opening_hours).toEqual(hours);
  });

  it("admin updates associations array", async () => {
    const { supabase } = await signInAs(SEED_EMAILS.admin);
    const associations = [{ name: "Club photo", description: "Sortie mensuelle" }];
    const { error } = await supabase
      .from("communes")
      .update({ associations })
      .eq("id", SEED_IDS.commune);
    expect(error).toBeNull();
    const after = await getCommune(SEED_IDS.commune);
    expect(after?.associations).toEqual(associations);
  });

  it("moderator cannot update address", async () => {
    const { supabase } = await signInAs(SEED_EMAILS.moderator);
    const before = await getCommune(SEED_IDS.commune);
    const { error } = await supabase
      .from("communes")
      .update({ address: "moderator hack" })
      .eq("id", SEED_IDS.commune);
    expect(error).toBeNull();
    const after = await getCommune(SEED_IDS.commune);
    expect(after?.address).toBe(before?.address);
  });

  it("resident cannot update opening_hours", async () => {
    const { supabase } = await signInAs(SEED_EMAILS.resident);
    const before = await getCommune(SEED_IDS.commune);
    const { error } = await supabase
      .from("communes")
      .update({ opening_hours: { lundi: "hack" } })
      .eq("id", SEED_IDS.commune);
    expect(error).toBeNull();
    const after = await getCommune(SEED_IDS.commune);
    expect(after?.opening_hours).toEqual(before?.opening_hours);
  });
});
