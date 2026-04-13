"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  approveUser,
  rejectUser,
  togglePinPost,
  deletePost,
} from "@rural-community-platform/shared";

export async function approveUserAction(
  userId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await approveUser(supabase, userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/dashboard");
  return { error: null };
}

export async function rejectUserAction(
  userId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await rejectUser(supabase, userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/dashboard");
  return { error: null };
}

export async function togglePinAction(
  postId: string,
  isPinned: boolean,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await togglePinPost(supabase, postId, isPinned);
  if (error) return { error: error.message };
  revalidatePath("/admin/dashboard");
  return { error: null };
}

export async function deletePostAction(
  postId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await deletePost(supabase, postId);
  if (error) return { error: error.message };
  revalidatePath("/admin/dashboard");
  return { error: null };
}
