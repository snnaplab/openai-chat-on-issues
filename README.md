# OpenAI Chat on Issues

This is a GitHub Actions for running OpenAI's chat in GitHub Issues.

## Usage

```
name: OpenAI Chat

on:
  issues:
    types: [opened]
  issue_comment:
    types: [created]

jobs:
  chat:
    name: Chat
    runs-on: ubuntu-latest
    steps:
      - uses: snnaplab/openai-chat-on-issues@v0.1.0
        with:
          openai-key: ${{ secrets.OPENAI_KEY }}
          model: 'gpt-3.5-turbo'
```
