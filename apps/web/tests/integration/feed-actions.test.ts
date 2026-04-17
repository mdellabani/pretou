import { beforeEach, describe, expect, it } from "vitest";
import { resetData, signInAs, serviceClient, SEED_IDS, SEED_EMAILS } from "./_fixtures";

describe("posts insert RLS", () => {
  beforeEach(async () => {
    await resetData();
  });

  it("admin can create an annonce", async () => {
    const { supabase, user } = await signInAs(SEED_EMAILS.admin);
    const { data, error } = await supabase
      .from("posts")
      .insert({
        commune_id: SEED_IDS.commune,
        author_id: user.id,
        title: "Avis officiel",
        body: "Coupure d'eau demain",
        type: "annonce",
      })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data?.title).toBe("Avis officiel");
  });

  it("moderator cannot create an annonce", async () => {
    const { supabase, user } = await signInAs(SEED_EMAILS.moderator);
    const { error } = await supabase.from("posts").insert({
      commune_id: SEED_IDS.commune,
      author_id: user.id,
      title: "Faux avis",
      body: "Test",
      type: "annonce",
    });
    expect(error).not.toBeNull();
  });

  it("resident cannot create an annonce", async () => {
    const { supabase, user } = await signInAs(SEED_EMAILS.resident);
    const { error } = await supabase.from("posts").insert({
      commune_id: SEED_IDS.commune,
      author_id: user.id,
      title: "Faux avis",
      body: "Test",
      type: "annonce",
    });
    expect(error).not.toBeNull();
  });

  it("resident can create a discussion", async () => {
    const { supabase, user } = await signInAs(SEED_EMAILS.resident);
    const { data, error } = await supabase
      .from("posts")
      .insert({
        commune_id: SEED_IDS.commune,
        author_id: user.id,
        title: "Question",
        body: "Quelqu'un sait quand passe le marché ?",
        type: "discussion",
      })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data?.type).toBe("discussion");
  });

  it("moderator can create a discussion", async () => {
    const { supabase, user } = await signInAs(SEED_EMAILS.moderator);
    const { data, error } = await supabase
      .from("posts")
      .insert({
        commune_id: SEED_IDS.commune,
        author_id: user.id,
        title: "Modération note",
        body: "Discussion test",
        type: "discussion",
      })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data?.type).toBe("discussion");
  });

  it("post_images attach to authored post", async () => {
    const { supabase, user } = await signInAs(SEED_EMAILS.resident);
    const { data: post } = await supabase
      .from("posts")
      .insert({
        commune_id: SEED_IDS.commune,
        author_id: user.id,
        title: "Photo",
        body: "Voici",
        type: "discussion",
      })
      .select()
      .single();
    expect(post).toBeTruthy();
    const { error } = await supabase
      .from("post_images")
      .insert({ post_id: post!.id, storage_path: "posts/test/img.png" });
    expect(error).toBeNull();
    const { data: images } = await serviceClient()
      .from("post_images")
      .select("*")
      .eq("post_id", post!.id);
    expect(images).toHaveLength(1);
  });
});
