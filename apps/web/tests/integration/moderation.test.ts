import { beforeEach, describe, expect, it } from "vitest";
import { resetData, signInAs, serviceClient, getPost, SEED_IDS, SEED_EMAILS } from "./_fixtures";

async function seedPost() {
  const svc = serviceClient();
  const { data, error } = await svc
    .from("posts")
    .insert({
      commune_id: SEED_IDS.commune,
      author_id: SEED_IDS.resident,
      title: "À modérer",
      body: "Contenu",
      type: "discussion",
    })
    .select()
    .single();
  if (error) throw error;
  return data!.id as string;
}

describe("posts moderation RLS", () => {
  beforeEach(async () => {
    await resetData();
  });

  it("admin can hide a post", async () => {
    const postId = await seedPost();
    const { supabase } = await signInAs(SEED_EMAILS.admin);
    const { error } = await supabase
      .from("posts")
      .update({ is_hidden: true })
      .eq("id", postId);
    expect(error).toBeNull();
    expect((await getPost(postId))?.is_hidden).toBe(true);
  });

  it("moderator can hide a post", async () => {
    const postId = await seedPost();
    const { supabase } = await signInAs(SEED_EMAILS.moderator);
    const { error } = await supabase
      .from("posts")
      .update({ is_hidden: true })
      .eq("id", postId);
    expect(error).toBeNull();
    expect((await getPost(postId))?.is_hidden).toBe(true);
  });

  it("resident cannot hide another's post", async () => {
    const postId = await seedPost();
    // The resident IS the author of seedPost above, so they're allowed
    // by the "Authors can update own posts" policy. Switch author.
    await serviceClient().from("posts").update({ author_id: SEED_IDS.admin }).eq("id", postId);
    const { supabase } = await signInAs(SEED_EMAILS.resident);
    const { error } = await supabase.from("posts").update({ is_hidden: true }).eq("id", postId);
    expect(error).toBeNull();
    expect((await getPost(postId))?.is_hidden).toBe(false);
  });

  it("admin can delete a post", async () => {
    const postId = await seedPost();
    const { supabase } = await signInAs(SEED_EMAILS.admin);
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    expect(error).toBeNull();
    expect(await getPost(postId)).toBeNull();
  });

  it("moderator can delete a post", async () => {
    const postId = await seedPost();
    const { supabase } = await signInAs(SEED_EMAILS.moderator);
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    expect(error).toBeNull();
    expect(await getPost(postId)).toBeNull();
  });

  it("resident cannot delete a non-authored post", async () => {
    const postId = await seedPost();
    await serviceClient().from("posts").update({ author_id: SEED_IDS.admin }).eq("id", postId);
    const { supabase } = await signInAs(SEED_EMAILS.resident);
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    expect(error).toBeNull();
    expect(await getPost(postId)).not.toBeNull();
  });
});
