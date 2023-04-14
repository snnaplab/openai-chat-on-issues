const core = require('@actions/core');
const { postChatMessages, postIssueComment, getIssueComments, TokenLengthError } = require('./libs');

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
    systemPrompt,
    ignoreKeywords,
    eventName,
    eventJson,
    githubToken,
  } = getInputs();

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
      await handleIssues(model, systemPrompt, ignoreKeywords, event, openaiKey, githubToken);
      break;
    }
    case 'issue_comment': {
      await handleIssueComment(model, systemPrompt, ignoreKeywords, event, openaiKey, githubToken);
      break;
    }
    default: {
      throw new Error('This action only works on issues or issue_comment events.');
    }
  }
}

async function handleIssues(model, systemPrompt, ignoreKeywords, event, openaiKey, githubToken) {
  if (event.action != 'opened') return;

  if (ignoreKeywords.some(keyword => event.issue.body.includes(keyword))) {
    return;
  }

  let reqMessages = [{role: 'user', content: event.issue.body}];

  if (systemPrompt) {
    reqMessages = [{role: 'system', content: systemPrompt}, ...reqMessages];
  }

  const resMessage = await postChatMessages(model, reqMessages, openaiKey);
  await postIssueComment(event.repository.full_name, event.issue.number, resMessage, githubToken);
}

async function handleIssueComment(model, systemPrompt, ignoreKeywords, event, openaiKey, githubToken) {
  if (event.action != 'created') return;
  if (event.issue.state != 'open') return;
  if (event.issue.pull_request) return;
  
  if (ignoreKeywords.some(keyword => event.comment.body.includes(keyword))) {
    return;
  }

  // idの昇順（コメントの古い順）で取得される
  const issueComments = await getIssueComments(event.repository.full_name, event.issue.number, githubToken);

  let retryCount = 0;
  for (;;) {
    let reqMessages = issueComments
      .filter(comment => comment.id <= event.comment.id) // 自身のコメントとそれより古いコメント
      .filter(comment => ignoreKeywords.every(keyword => !comment.body.includes(keyword)))
      .slice(retryCount) // トークンの長さエラーでリトライする度に、古いコメントを削除する
      .map(comment => ({role: comment.user.type == 'Bot' ? 'assistant' : 'user', content: comment.body}));

    // 1件目はIssueのbody
    reqMessages = [{role: 'user', content: event.issue.body}, ...reqMessages];

    if (systemPrompt) {
      reqMessages = [{role: 'system', content: systemPrompt}, ...reqMessages];
    }

    try {
      const resMessage = await postChatMessages(model, reqMessages, openaiKey);
      await postIssueComment(event.repository.full_name, event.issue.number, resMessage, githubToken);
      break;
    } catch(e) {
      if (e instanceof TokenLengthError) {
        // Issueのbodyのみでトークンの長さエラーとなる場合は、もうリトライせずエラーとする
        if (reqMessages.filter(message => message.role == 'user').length <= 1) {
          throw e;
        }
        retryCount++;
        continue;
      } else {
        throw e;
      }
    }
  }
}

function getInputs() {
  if (NODE_ENV == 'development') {
    return {
      openaiKey: OPENAI_TOKEN,
      model: 'gpt-3.5-turbo',
      systemPrompt: '語尾ににゃーをつけてください。',
      ignoreKeywords: [],
      eventName: 'issue_comment',
      eventJson: JSON.stringify({
        action: 'created',
        issue: {
          number: 6,
          state: 'open',
          body: 'こんにちは。あなたは誰ですか？ ignore2DDDD',
          pull_request: null,
        },
        comment: {
          id: 9999999999,
          body: 'こんにちは。あなたは誰ですか？ ',
        },
        repository: {
          full_name: 'snnaplab/action-dev',
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
    systemPrompt: core.getInput('system-prompt', { required: false }),
    ignoreKeywords: core.getMultilineInput('ignore-keywords', { required: false }) || [],
    eventName: core.getInput('event-name', { required: true }),
    eventJson: core.getInput('event', { required: true }),
    githubToken: core.getInput('github-token', { required: true }),
  };
}

main()
  .catch(error => {
    core.setFailed(error.message);
  });
