# OpenAI Chat on Issues

This is a GitHub Actions for running OpenAI's chat on GitHub Issues.

<img src="doc/action.png" width="500" />

## Usage

### Basic usage

```yaml
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
      - uses: snnaplab/openai-chat-on-issues@v1
        with:
          openai-key: ${{ secrets.OPENAI_KEY }}
          model: 'gpt-4' # option, default is 'gpt-3.5-turbo'
          system-prompt: | # option
            You are a helpful assistant.
```

Available models are listed in [Model endpoint compatibility](https://platform.openai.com/docs/models/model-endpoint-compatibility) (This action use `/v1/chat/completions` endpoint).
However, it may depend on the circumstances of the account that issued the key.

### Cancel when a new comment is made

```yaml
name: OpenAI Chat

on:
  issues:
    types: [opened]
  issue_comment:
    types: [created]

concurrency:
  group: ${{ github.workflow }}-${{ github.event.issue.number || github.run_id }}
  cancel-in-progress: true
```


## Required permissions

`issues: write` permission is required.
If necessary, specify in the workflow as follows.

```yaml
name: OpenAI Chat

on:
  issues:
    types: [opened]
  issue_comment:
    types: [created]

permissions:
  issues: write

...
  
```