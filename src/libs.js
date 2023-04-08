const github = require('@actions/github');
const { Configuration, OpenAIApi } = require("openai");

async function postChatMessage(model, userMessage, openaiKey) {
  const configuration = new Configuration({
    apiKey: openaiKey,
  });
  const openai = new OpenAIApi(configuration);

  try {
    const completion = await openai.createChatCompletion({
      model: model,
      messages: [{role: "user", content: userMessage}],
    });
    return completion.data.choices[0].message.content;
  } catch(e) {
    handleOpenAiError(e);
  }
}

function handleOpenAiError(e) {
  throw Error(createOpenAiErrorMessage(e, e?.response?.data?.error?.message));
}

function createOpenAiErrorMessage(e, detail) {
  let message = `OpenAI API error (message: ${e.message}).`;
  if (detail) {
    message = `${message} ${detail}`;
  }
  return message;
}

async function postIssueComment(repository, number, comment, githubToken) {
  const [owner, repo] = repository.split('/');
  const octokit = github.getOctokit(githubToken);

  try {
    // https://docs.github.com/ja/rest/issues/comments?apiVersion=2022-11-28#create-an-issue-comment
    await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      owner: owner,
      repo: repo,
      issue_number: number,
      body: comment,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })
  } catch (e) {
    handleGitHubError(e);
  }
}

function handleGitHubError(e) {
  let message;

  switch (e.response.status) {
    case 401: {
      message = createGitHubErrorMessage(e, 'GitHub token may be wrong.');
      break;
    }
    case 403: { // SSOの承認がされていない場合等
      message = createGitHubErrorMessage(e, 'GitHub token may not have enough permissions.');
      break;
    }
    case 404: {
      message = createGitHubErrorMessage(e, 'Review the inputs "repository", "pull-request-number", "github-token".');
      break;
    }
    default: { // その他はここにまとめる
      message = createGitHubErrorMessage(e);
    }
  }
  throw Error(message);
}

function createGitHubErrorMessage(e, hint) {
  let message = `GitHub API error (message: ${e.message}).`;
  if (hint) {
    message = `${message} ${hint}`;
  }
  return message;
}

//function getMatchedFiles(files, paths, adds, modifies, renames, removes) {
//  return files.filter(file => isMatchedPaths(file, paths.map(trimQuotes)))
//    .filter(file => isMatchedStatus(file, adds, modifies, renames, removes));
//}

module.exports = {
  postChatMessage,
  handleOpenAiError,
  createOpenAiErrorMessage,
  postIssueComment,
  handleGitHubError,
  createGitHubErrorMessage,
};
