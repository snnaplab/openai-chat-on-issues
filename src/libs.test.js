const nock = require('nock');
const { postChatMessages, postIssueComment, getIssueComments } = require('./libs');

describe('Github and OpenAI API functions', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('should send a chat message and return the response', async () => {
    const model = 'text-davinci-002';
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];
    const openaiKey = 'test-api-key';

    nock('https://api.openai.com')
      .post('/v1/chat/completions')
      .reply(200, {
        choices: [
          {
            message: {
              content: 'How can I help you today?',
            },
          },
        ],
      });

    const result = await postChatMessages(model, messages, openaiKey);
    expect(result).toBe('How can I help you today?');
  });

  it('should post a comment on a GitHub issue', async () => {
    const repository = 'test-owner/test-repo';
    const issueNumber = 1;
    const comment = 'This is a test comment.';
    const githubToken = 'test-github-token';

    nock('https://api.github.com')
      .post('/repos/test-owner/test-repo/issues/1/comments', { body: comment })
      .reply(201, {});

    await postIssueComment(repository, issueNumber, comment, githubToken);
  });

  it('should get comments from a GitHub issue', async () => {
    const repository = 'test-owner/test-repo';
    const issueNumber = 1;
    const githubToken = 'test-github-token';

    nock('https://api.github.com')
      .get('/repos/test-owner/test-repo/issues/1/comments')
      .query({ per_page: 100, page: 1 })
      .reply(200, [
        {
          id: 1,
          body: 'This is a test comment.',
        },
      ]);
    nock('https://api.github.com')
      .get('/repos/test-owner/test-repo/issues/1/comments')
      .query({ per_page: 100, page: 2 })
      .reply(200, []);

    const comments = await getIssueComments(repository, issueNumber, githubToken);
    expect(comments.length).toBe(1);
    expect(comments[0].id).toBe(1);
    expect(comments[0].body).toBe('This is a test comment.');
  });
});
