const core = require('@actions/core');
const { postChatMessage, postIssueComment } = require('./libs');

require('dotenv').config();

// ローカルで実行する際に npm script で設定される
const NODE_ENV = process.env['NODE_ENV'];

// ローカルで実行する場合は .env ファイルを用意しておく（コミット対象外）
const GITHUB_TOKEN = process.env['GITHUB_TOKEN'];
const OPENAI_TOKEN = process.env['OPENAI_TOKEN'];

async function main() {

  const {
    openaiKey,
    model,
    history,
    eventName,
    eventJson,
    githubToken,
  } = getInputs();

  // 現在はこの２つのみ対応
  if (model != 'gpt-3.5-turbo' && model != 'gpt-4') {
    throw new Error('model input must be gpt-3.5-turbo or gpt-4.');
  }
  
  let event;
  try {
    event = JSON.parse(eventJson);
  } catch (e) {
    throw new Error('event input is not a valid JSON string.');
  }

  // 主要な項目だけ存在をチェック
  if (!event.action || !event.issue?.number || !event.comment?.id || !event.repository?.full_name) {
    throw new Error('event input is not a valid JSON string.');
  }

  switch (eventName) {
    case 'issues': {
      await handleIssues(model, event, openaiKey, githubToken);
      break;
    }
    case 'issue_comment': {
      await handleIssueComment();
      break;
    }
    default: {
      throw new Error('This action only works on issues or issue_comment events.');
    }
  }
}

async function handleIssues(model, event, openaiKey, githubToken) {
  if (event.action != 'opened') return;

  const message = await postChatMessage(model, event.issue.body, openaiKey);
  await postIssueComment(event.repository.full_name, event.issue.number, message, githubToken);
}

async function handleIssueComment(model, event, openaiKey, githubToken) {
  if (event.action != 'created') return;
  if (event.issue.state != 'open') return;
  if (event.issue.pull_request) return;

  // TODO
}

function getInputs() {
  if (NODE_ENV == 'local') {
    return {
      openaiKey: OPENAI_TOKEN,
      model: 'gpt-3.5-turbo',
      history: 5,
      eventName: 'issues',
      eventJson: JSON.stringify({
        action: 'opened',
        issue: {
          number: 33,
          state: 'open',
          body: 'こんにちは。あなたは誰ですか？',
          pull_request: {},
        },
        comment: {
          id: 99999999,
          body: 'コメント body',
        },
        repository: {
          full_name: 'yumemi/hkusu-android-danger-test',
        },
      }),
      githubToken: GITHUB_TOKEN,
    };
  }

  // event については、CI 上でパラメータを偽装して動作確認等もできる為、@actiohs/github からは取得せず input で渡している
  return {
    // { required: true } を指定すると、空文字が指定された場合にもエラーとなってくれる
    openaiKey: core.getInput('openai-key', { required: true }),
    model: core.getInput('model', { required: true }), // 空文字を指定されるとデフォルト値が得られないので、デフォルト値を定義していたとしても { required: true } による必須チェックが必要
    history: parseInt(core.getInput('history', { required: true })) || 5,
    eventName: core.getInput('event-name', { required: true }),
    eventJson: core.getInput('event', { required: true }),
    githubToken: core.getInput('github-token', { required: true }),
  };
}

main()
  .catch(error => {
    core.setFailed(error.message);
  });
