import { NextResponse } from "next/server";
import {
  generateAppJwt,
  getInstallationToken,
  createGitHubIssue,
} from "@/lib/github-app-auth";
import { buildIssueBody, type FeedbackFormData, type FeedbackContext } from "@/lib/feedback-config";

export async function POST(request: Request) {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  const feedbackRepo = process.env.FEEDBACK_REPO;

  if (!appId || !privateKey || !installationId || !feedbackRepo) {
    return NextResponse.json(
      { error: "Feedback integration not configured" },
      { status: 500 }
    );
  }

  let body: { data: FeedbackFormData; context: FeedbackContext };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { data, context } = body;

  if (!data.title?.trim() || !data.description?.trim()) {
    return NextResponse.json(
      { error: "Title and description are required" },
      { status: 400 }
    );
  }

  try {
    const appJwt = generateAppJwt(appId, privateKey);
    const token = await getInstallationToken(appJwt, installationId);

    const prefix = data.type === "bug" ? "[Bug]" : "[Feature]";
    const labels = data.type === "bug" ? ["bug"] : ["enhancement"];
    const issueBody = buildIssueBody(data, context);

    const issue = await createGitHubIssue({
      token,
      repo: feedbackRepo,
      title: `${prefix} ${data.title}`,
      body: issueBody,
      labels,
    });

    return NextResponse.json({
      success: true,
      issueNumber: issue.number,
      issueUrl: issue.html_url,
    });
  } catch (err) {
    console.error("Failed to create feedback issue:", err);
    return NextResponse.json(
      { error: "Failed to submit feedback. Please try again." },
      { status: 500 }
    );
  }
}
