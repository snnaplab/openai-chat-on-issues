const core = require('@actions/core');
const { postChatMessages, postIssueComment, getIssueComments } = require('./libs');

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
  if (!event.action || !event.issue?.number || !event.repository?.full_name) {
    throw new Error('event input is not a valid JSON string.');
  }

  switch (eventName) {
    case 'issues': {
      await handleIssues(model, event, openaiKey, githubToken);
      break;
    }
    case 'issue_comment': {
      await handleIssueComment(model, history, event, openaiKey, githubToken);
      break;
    }
    default: {
      throw new Error('This action only works on issues or issue_comment events.');
    }
  }
}

async function handleIssues(model, event, openaiKey, githubToken) {
  if (event.action != 'opened') return;

  const reqMessages = [{role: 'user', content: event.issue.body}];
  const resMessage = await postChatMessages(model, reqMessages, openaiKey);
  await postIssueComment(event.repository.full_name, event.issue.number, resMessage, githubToken);
}

async function handleIssueComment(model, history, event, openaiKey, githubToken) {
  if (event.action != 'created') return;
  if (event.issue.state != 'open') return;
  if (event.issue.pull_request) return;
  
  // idの昇順（コメントの古い順）で取得される
  const issueComments = await getIssueComments(event.repository.full_name, event.issue.number, githubToken);

  const reqMessages = issueComments
    .filter(comment => comment.id <= event.comment.id) // 自身のコメントとそれより古いコメント
    .slice(-(history + 1)) // 自身のコメント含む、新しいhistory+1件
    .map(comment => ({role: comment.user.type == 'Bot' ? 'assistant' : 'user', content: comment.body}));

  // Issueのbodyはhistoryの数に関係なく1件目に
  reqMessages.unshift({role: 'user', content: event.issue.body});

  const resMessage = await postChatMessages(model, reqMessages, openaiKey);
  await postIssueComment(event.repository.full_name, event.issue.number, resMessage, githubToken);
}

function getInputs() {
  if (NODE_ENV == 'local') {
    return {
      openaiKey: OPENAI_TOKEN,
      model: 'gpt-3.5-turbo',
      history: 10,
      eventName: 'issue_comment',
      eventJson: JSON.stringify({
        action: 'created',
        issue: {
          number: 3,
          state: 'open',
          body: 'こんにちは。あなたは誰ですか？',
          pull_request: null,
        },
        comment: {
          id: 9999999999,
          body: 'コメント body',
        },
        repository: {
          full_name: 'snnaplab/openai-chat-on-issues',
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
    history: parseInt(core.getInput('history', { required: true })) || 10,
    eventName: core.getInput('event-name', { required: true }),
    eventJson: core.getInput('event', { required: true }),
    githubToken: core.getInput('github-token', { required: true }),
  };
}

main()
  .catch(error => {
    core.setFailed(error.message);
  });
