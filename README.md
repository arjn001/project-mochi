# Mochi Companion

> **This is an early preview.** Things may change, and some features are still on their way.

Mochi is a cozy cat who lives in VS Code and keeps you company while you code. It explains errors and code in plain words, helping you learn instead of handing you answers. It uses an AI you already have, and it only thinks when you ask. [What stays on your computer](#privacy)

## What Mochi does

- **Chats in its own tab**, next to your code. Your conversation is kept for each project, so it's there when you come back.
- **Explains errors and code.** Click **Explain with Mochi** in the lightbulb next to an error, or right-click selected code and choose **Explain this**. In Learning mode (on by default), Mochi explains first, then offers a hint, and shows the fix only when you ask.
- **Keeps you company:** a greeting when you open VS Code, a focus timer (**Mochi: Start a focus session**), and late-night company. Quiet mode lets it nap in the status bar.
- **Sets up Python projects:** **Mochi: Set up a Python project** creates a virtual environment, asks before installing anything, and offers Undo.
- **Asks before sharing your code.** Mochi names the AI and asks first, and it never sends `.env` or key files.

## Giving Mochi a brain

Mochi needs an AI to answer questions. Everything else works without one.

- **GitHub Copilot** (the free plan works): sign in to GitHub Copilot in VS Code, and Mochi uses it. Each question uses your Copilot plan.
- **Your own Claude API key:** run **Mochi: Add a Claude key**. Each answer is billed to your Claude account, per use. A Claude Pro or Max subscription can't be used here.

Run **Mochi: Choose a brain** anytime to pick which one Mochi thinks with.

## Privacy

What Mochi keeps stays on your computer, in Mochi's private storage, and is never synced:

- **Your chats**, one per project, for your 20 most recent projects. In remote setups (SSH, WSL, containers), a project's chat is kept on that remote machine, next to your code.
- **Your name and personal touches**, if you set them, and small reminders like the day you were last greeted.
- **Your Claude key**, if you add one, in your system's keychain.

Nothing is sent anywhere except to the brain you picked, and only when you ask something. Code goes along only after you say yes. **Mochi: Forget everything** clears your chats and everything Mochi remembers about you. Your settings and any saved key stay as they are.

## Notice

The code is licensed under the MIT License (see LICENSE). The name "Mochi Companion", Mochi's icons, and its art are all rights reserved, and are not covered by the MIT License.

Third-party code bundled with Mochi is listed in THIRD_PARTY_NOTICES.md.
