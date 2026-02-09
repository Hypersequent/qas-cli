Perform a comprehensive code review of this pull request using specialized subagents, then post inline comments.

Use the **Owner**, **Repository**, and **Pull Request Number** from the context provided by the caller for all API calls below.

## Step 1: Gather Context (avoid anchoring/bias from prior bot output)

1. Use `gh pr view` to get the PR title, body, and linked issues
2. If the PR body contains issue references (e.g., "Fixes #123", "Closes #123"), use `gh issue view <number>` to understand the requirements
3. Use `mcp__github__get_pull_request_diff` to get the full diff (paginate if needed)
4. Do NOT fetch/read existing review comments yet. Subagents should review the diff independently; we'll fetch comments later for deduplication and cleanup.

## Step 2: Launch Specialized Review Subagents

Use the Task tool to launch these subagents IN PARALLEL. Each subagent should analyze the PR diff and return a list of specific issues with file paths and line numbers.

**Subagent 1: Code Quality Reviewer**

```
Review the PR for code quality issues:
- Clean code principles: naming, function size, single responsibility
- Code duplication and DRY violations
- Error handling completeness and edge cases
- Code readability and maintainability
- Magic numbers/strings that should be constants
- Commented-out code or debug statements

For TypeScript: Check for proper types (avoid `any`), top-level `import type`, Zod validation usage, proper ESM imports with .js extensions.

Return ONLY noteworthy issues with: file path, line number, issue description, suggested fix.
```

**Subagent 2: Security Reviewer**

```
Review the PR for security vulnerabilities:
- OWASP Top 10: injection, XSS, broken auth, sensitive data exposure
- Input validation and sanitization at system boundaries
- Authentication/authorization checks
- Hardcoded credentials or secrets
- Insecure cryptographic practices
- Path traversal vulnerabilities

Return ONLY noteworthy issues with: file path, line number, severity (critical/high/medium/low), issue description, remediation.
```

**Subagent 3: Performance Reviewer**

```
Review the PR for performance issues:
- Algorithmic complexity (O(n^2) or worse operations)
- Unnecessary computations or redundant operations
- Memory leaks from unclosed resources
- Missing caching or memoization opportunities
- Blocking operations that should be async

Return ONLY noteworthy issues with: file path, line number, issue description, performance impact, suggested optimization.
```

**Subagent 4: Test Coverage Reviewer**

```
Review the PR for test coverage:
- Are new functions/methods adequately tested?
- Missing edge case tests
- Missing error path tests
- Test quality (proper assertions, isolation, naming)

Return ONLY noteworthy gaps with: file path, what's missing, suggested test case.
```

## Step 3: Aggregate, Deduplicate, and Post a SINGLE Review (then clean up old bot noise)

1. Collect all findings from subagents
2. Filter to keep only genuinely noteworthy issues (skip minor style nitpicks)
3. Fetch existing bot output ONLY AFTER subagents have finished (call both in parallel):
   - Inline review comments: `gh api repos/{owner}/{repo}/pulls/{pr_number}/comments`
     - Store: `id`, `node_id`, `user.login`, `user.type`, `path`, `line` (or `original_line` if needed), `body`, `created_at`, `in_reply_to_id`
   - Reviews: `gh api repos/{owner}/{repo}/pulls/{pr_number}/reviews`
     - Store: `id`, `node_id`, `user.login`, `user.type`, `body`, `submitted_at`
4. **Deduplicate against existing comments**: For each finding, check if a similar comment already exists at the same file path and line number (or nearby lines within +/-3 lines). Skip posting if an existing comment (human or bot) already addresses the same issue.
5. **IMPORTANT — Post ALL comments as ONE review using the pending review flow:**
   a. Call `mcp__github__create_pending_pull_request_review` ONCE to start a pending review
   b. Call `mcp__github__add_comment_to_pending_review` for ALL new noteworthy issues — call these IN PARALLEL in a single turn to save turns
   c. Call `mcp__github__submit_pending_pull_request_review` ONCE with event type "REQUEST_CHANGES" if there are noteworthy issues (High to Critical severity), otherwise "APPROVE"
   **DO NOT use `create_inline_comment` or `pull_request_review_write` — these create a separate review per comment.**
6. **Clean up outdated bot review threads and review bodies** (keep useful unique items):

   **6a. Resolve outdated bot-authored inline comment threads:**
   - Query review threads using the GitHub GraphQL API:
     ```bash
     gh api graphql -f query='
       query($owner:String!, $repo:String!, $pr:Int!) {
         repository(owner:$owner, name:$repo) {
           pullRequest(number:$pr) {
             reviewThreads(last:100) {
               nodes {
                 id
                 isResolved
                 comments(first:1) {
                   nodes {
                     author { login }
                     body
                     path
                     line
                   }
                 }
               }
             }
           }
         }
       }' -f owner='OWNER' -f repo='REPO' -F pr=NUMBER
     ```
     (Substitute the actual owner, repo name, and PR number from the context provided by the caller.)
   - From the returned threads, identify bot-authored threads: threads where `comments.nodes[0].author.login` matches the bot user login seen in the REST review comments from step 3.3.
   - Skip threads that are already resolved (`isResolved == true`).
   - Skip threads where the first comment author is a human (non-bot).
   - Among the remaining bot-authored threads, identify those that are **redundant** (same `path` and `line` +/-3 as another bot thread, addressing substantially the same issue). Keep the thread belonging to the most recent review; resolve the older duplicates.
   - Use the `resolveReviewThread` mutation for each outdated thread:
     ```bash
     gh api graphql -f query='mutation($threadId:ID!) { resolveReviewThread(input:{threadId:$threadId}) { thread { isResolved } } }' -f threadId='<THREAD_NODE_ID>'
     ```
   - Never resolve threads that contain human-authored comments.

   **6b. Minimize outdated bot PR review summaries:**
   - From the reviews fetched in step 3.3, identify bot-authored PR reviews (`user.type == "Bot"`) with non-empty `body`.
   - Keep the most recent bot review (by `submitted_at`). For all older bot reviews, minimize using `classifier: OUTDATED`:
     ```bash
     gh api graphql -f query='mutation($id:ID!){ minimizeComment(input:{subjectId:$id, classifier:OUTDATED}){ minimizedComment { isMinimized } } }' -f id='<REVIEW_NODE_ID>'
     ```
   - Never minimize human-authored reviews.

## Step 4: Clean up progress tracking comments

After the review is submitted, delete any progress tracking comments left by the bot on this PR.

1. Fetch issue comments (these are PR-level comments, not inline review comments):
   ```bash
   gh api repos/{owner}/{repo}/issues/{pr_number}/comments --paginate
   ```
2. Identify progress comments: bot-authored comments (`user.type == "Bot"`) whose `body` matches EITHER of these patterns:
   - Body starts with `**Claude finished @`
   - Body contains `Claude Code is working`
3. Delete each matching comment:
   ```bash
   gh api -X DELETE repos/{owner}/{repo}/issues/{pr_number}/comments/{comment_id}
   ```
4. If no progress comments are found, skip silently. Do not fail if a deletion returns an error (the comment may have already been deleted).

## Guidelines

- Be constructive and provide actionable suggestions
- Focus on significant issues that could cause bugs, security vulnerabilities, or maintenance problems
- Skip minor style issues that don't affect functionality
- Use English for all comments
- If no noteworthy issues are found, submit a brief approving comment
- Keep the review concise and to the point to optimize for the reader's time.
