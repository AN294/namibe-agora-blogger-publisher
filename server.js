import express from 'express';
import crypto from 'node:crypto';
import { google } from 'googleapis';

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL;
const CID = process.env.GOOGLE_CLIENT_ID;
const SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT =
  process.env.GOOGLE_REDIRECT_URI ||
  (APP_URL ? `${APP_URL}/auth/callback` : undefined);

const sessions = new Map();

const oauth = () => {
  return new google.auth.OAuth2(
    CID,
    SECRET,
    REDIRECT
  );
};

const getCookie = (req, name) => {
  const match = req.headers.cookie?.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]+)`)
  );

  return match ? match[1] : null;
};

const getSession = (req) => {
  const sid = getCookie(req, 'sid');
  return sid ? sessions.get(sid) : null;
};

const configurationError = () => {
  const missing = [];

  if (!APP_URL) missing.push('APP_URL');
  if (!CID) missing.push('GOOGLE_CLIENT_ID');
  if (!SECRET) missing.push('GOOGLE_CLIENT_SECRET');
  if (!REDIRECT) missing.push('GOOGLE_REDIRECT_URI');

  return missing;
};

app.get('/', (req, res) => {
  const session = getSession(req);

  res.send(`
<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<title>NAMIBE AGORA Publisher</title>

<style>
body{
  font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  background:#0b0d14;
  color:#f4f5f7;
  margin:0;
}

main{
  max-width:850px;
  margin:40px auto;
  padding:20px;
}

.card{
  background:#151925;
  border:1px solid #2b3040;
  border-radius:18px;
  padding:24px;
}

input,
textarea,
select{
  width:100%;
  box-sizing:border-box;
  background:#0e111a;
  color:#fff;
  border:1px solid #303649;
  border-radius:10px;
  padding:12px;
  margin:7px 0 14px;
}

textarea{
  min-height:250px;
}

button{
  background:#7c5cff;
  color:#fff;
  border:0;
  border-radius:10px;
  padding:12px 18px;
  font-weight:700;
  cursor:pointer;
}

button:hover{
  opacity:.9;
}

p{
  color:#aeb4c4;
}

.ok{
  color:#55d68b;
}

.error{
  color:#ff7070;
}
</style>
</head>

<body>

<main>

<h1>📰 NAMIBE AGORA</h1>

<p>Publisher para Blogger</p>

<div class="card">

${
  session?.tokens
    ? `
      <p class="ok">● Google conectado</p>

      <form method="post" action="/publish">

        <label>Blog</label>

        <select
          name="blogId"
          id="blogId"
          required
        ></select>

        <label>Título</label>

        <input
          name="title"
          required
          placeholder="Título da publicação"
        >

        <label>Conteúdo HTML</label>

        <textarea
          name="content"
          required
          placeholder="Escreva o conteúdo da publicação..."
        ></textarea>

        <label>Imagem principal — URL pública, opcional</label>

        <input
          name="imageUrl"
          type="url"
          placeholder="https://..."
        >

        <button type="submit">
          Publicar no Blogger
        </button>

      </form>
    `
    : `
      <p>Conecte a sua conta Google para começar.</p>

      <button
        onclick="location.href='/auth/google'"
      >
        Conectar Google
      </button>
    `
}

</div>

</main>

<script>

async function loadBlogs(){

  const select = document.getElementById('blogId');

  if(!select){
    return;
  }

  try{

    const response = await fetch('/api/blogs');

    const data = await response.json();

    if(!response.ok){

      select.innerHTML =
        '<option>Erro ao carregar blogs</option>';

      console.error(data);

      return;
    }

    const blogs = data.items || [];

    if(!blogs.length){

      select.innerHTML =
        '<option>Nenhum blog encontrado</option>';

      return;
    }

    select.innerHTML = blogs
      .map(blog =>
        '<option value="' +
        blog.id +
        '">' +
        blog.name +
        '</option>'
      )
      .join('');

  }catch(error){

    console.error(error);

    select.innerHTML =
      '<option>Erro de conexão</option>';

  }

}

loadBlogs();

</script>

</body>
</html>
  `);
});


/*
  INICIAR LOGIN GOOGLE
*/

app.get('/auth/google', (req, res) => {

  const missing = configurationError();

  if(missing.length){

    return res
      .status(500)
      .send(`
        <h2>Configuração incompleta</h2>
        <p>Faltam estas variáveis no Vercel:</p>
        <ul>
          ${missing.map(item => `<li>${item}</li>`).join('')}
        </ul>
      `);
  }

  const state = crypto
    .randomBytes(24)
    .toString('hex');

  res.setHeader(
    'Set-Cookie',
    `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/`
  );

  const authorizationUrl =
    oauth().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/blogger'
      ],
      state
    });

  res.redirect(authorizationUrl);
});


/*
  CALLBACK DO GOOGLE
*/

app.get('/auth/callback', async (req, res) => {

  try{

    if(req.query.error){

      return res
        .status(400)
        .send(
          `Login Google cancelado: ${req.query.error}`
        );
    }

    const savedState =
      getCookie(req, 'oauth_state');

    const receivedState =
      req.query.state;

    if(
      !savedState ||
      !receivedState ||
      savedState !== receivedState
    ){

      return res
        .status(400)
        .send('Estado OAuth inválido.');
    }

    if(!req.query.code){

      return res
        .status(400)
        .send('Código OAuth não recebido.');
    }

    const { tokens } =
      await oauth().getToken(req.query.code);

    const sid =
      crypto.randomBytes(24).toString('hex');

    sessions.set(
      sid,
      {
        tokens,
        createdAt: Date.now()
      }
    );

    res.setHeader(
      'Set-Cookie',
      [
        `sid=${sid}; HttpOnly; Secure; SameSite=Lax; Path=/`,
        'oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
      ]
    );

    res.redirect('/');

  }catch(error){

    console.error(
      'Erro OAuth:',
      error
    );

    res
      .status(500)
      .send(
        'Falha no login Google: ' +
        (error?.message || 'erro desconhecido')
      );
  }

});


/*
  LISTAR BLOGS DO UTILIZADOR
*/

app.get('/api/blogs', async (req, res) => {

  try{

    const session =
      getSession(req);

    if(!session){

      return res
        .status(401)
        .json({
          error:'Não conectado'
        });
    }

    const auth = oauth();

    auth.setCredentials(
      session.tokens
    );

    const blogger =
      google.blogger({
        version:'v3',
        auth
      });

    const { data } =
      await blogger.blogs.listByUser({
        userId:'self'
      });

    res.json(data);

  }catch(error){

    console.error(
      'Erro ao listar blogs:',
      error
    );

    res
      .status(500)
      .json({
        error:
          error?.message ||
          'Erro ao carregar blogs'
      });
  }

});


/*
  PUBLICAR NO BLOGGER
*/

app.post('/publish', async (req, res) => {

  try{

    const session =
      getSession(req);

    if(!session){

      return res
        .status(401)
        .send(
          'Conecte o Google primeiro.'
        );
    }

    const {
      blogId,
      title,
      content,
      imageUrl
    } = req.body;

    if(!blogId){

      return res
        .status(400)
        .send(
          'Selecione um blog.'
        );
    }

    if(!title){

      return res
        .status(400)
        .send(
          'Informe o título.'
        );
    }

    if(!content){

      return res
        .status(400)
        .send(
          'Informe o conteúdo.'
        );
    }

    const html = imageUrl
      ? `
        <p>
          <img
            src="${imageUrl}"
            alt=""
            style="max-width:100%;height:auto"
          >
        </p>
        ${content}
      `
      : content;

    const auth = oauth();

    auth.setCredentials(
      session.tokens
    );

    const blogger =
      google.blogger({
        version:'v3',
        auth
      });

    const { data } =
      await blogger.posts.insert({
        blogId,
        requestBody:{
          title,
          content:html
        }
      });

    res.send(`
<!doctype html>

<html lang="pt">

<head>

<meta charset="utf-8">

<meta name="viewport"
content="width=device-width,initial-scale=1">

<title>Publicado</title>

<style>

body{
  font-family:system-ui;
  background:#0b0d14;
  color:#fff;
  padding:40px;
}

.ok{
  color:#55d68b;
}

a{
  color:#9b87ff;
}

</style>

</head>

<body>

<h2 class="ok">
✓ Publicado com sucesso!
</h2>

<p>
A publicação foi enviada para o Blogger.
</p>

${
  data.url
    ? `
      <p>
        <a
          href="${data.url}"
          target="_blank"
          rel="noopener"
        >
          Abrir publicação
        </a>
      </p>
    `
    : ''
}

<p>
<a href="/">
Voltar ao Publisher
</a>
</p>

</body>

</html>
    `);

  }catch(error){

    console.error(
      'Erro ao publicar:',
      error
    );

    res
      .status(500)
      .send(
        'Erro ao publicar: ' +
        (error?.message ||
        'erro desconhecido')
      );
  }

});


/*
  HEALTH CHECK
*/

app.get('/health', (req, res) => {

  res.json({
    status:'online',
    project:
      'NAMIBE AGORA Blogger Publisher',
    vercel:
      Boolean(process.env.VERCEL)
  });

});


/*
  VERCEL
*/

export default app;


/*
  EXECUÇÃO LOCAL
*/

if(!process.env.VERCEL){

  app.listen(
    PORT,
    () => {
      console.log(
        'Publisher online na porta ' +
        PORT
      );
    }
  );

  }
