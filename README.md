# OpenAI Chat on Issues

This is a GitHub Actions for running OpenAI's chat on GitHub Issues.

<img src="doc/action.png" width="500" />

## Usage

### Basic usage

1. Prepare a yaml file that describes the workflow below.
2. Place it in the default branch.

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

Available models are listed in [Model endpoint compatibility](https://platform.openai.com/docs/models/model-endpoint-compatibility) ( This action use `/v1/chat/completions` endpoint ).
However, it may depend on the circumstances of the account that issued the key.

### Cancel existing response on new comment

```yaml
name: OpenAI Chat

on:
  issues:
    types: [opened]
  issue_comment:
    types: [created]

concurrency: # add these
  group: ${{ github.workflow }}-${{ github.event.issue.number || github.run_id }}
  cancel-in-progress: true

...
```

### Respond only to mentions
  
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
    if: startsWith(github.event.issue.body, '/openai ') || startsWith(github.event.comment.body, '/openai ') # add this
    runs-on: ubuntu-latest
    steps:
      - uses: snnaplab/openai-chat-on-issues@v1
...
```

### Respond only to issues with a specific title

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
    if: contains(github.event.issue.title, 'openai') # add this
    runs-on: ubuntu-latest
    steps:
      - uses: snnaplab/openai-chat-on-issues@v1
...
```

### Respond only to issues with a specific label

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
    if: contains(github.event.issue.labels.*.name, 'openai') # add this
    runs-on: ubuntu-latest
    steps:
      - uses: snnaplab/openai-chat-on-issues@v1
...
```

### Exclude comments containing specific keywords

Conversations between users, or comments you don't want AI to refer to.

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
          ignore-keywords: | # add these
            AI bot ignore
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

permissions: # add these
  issues: write

...  
```

## Tips

It is convenient to prepare frequently used prompts as custom templates for issues.
ref: [Configuring issue templates for your repository](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository)

## Other topics

### Prevent jobs from starting on pull request comments

The `issue_comment` trigger fires even on pull request comments.
This action is passed through, so there is no problem, but to prevent extra jobs from starting, do the following:

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
    if: github.event.issue.pull_request == null # add this
    runs-on: ubuntu-latest
    steps:
      - uses: snnaplab/openai-chat-on-issues@v1
...
```

## Blog post

- (Japanese) [GitHub Issues を ChatGPT のようにするツールを作った話](https://zenn.dev/yumemi_inc/articles/3be60d32acbfd3)
