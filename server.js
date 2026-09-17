import express from 'express';

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send(`
<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>NAMIBE AGORA Publisher</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #0b0d14;
      color: #f4f5f7;
      margin: 0;
      padding: 40px 20px;
    }

    main {
      max-width: 850px;
      margin: auto;
    }

    .card {
      background: #151925;
      border: 1px solid #2b3040;
      border-radius: 18px;
      padding: 24px;
    }

    .ok {
      color: #55d68b;
    }

    a {
      color: #9b87ff;
    }
  </style>
</head>

<body>
  <main>
    <div class="card">
      <h1>📰 NAMIBE AGORA</h1>
      <p>Publisher para Blogger</p>
      <p class="ok">● Aplicação online</p>
      <p>A ligação Google será configurada na próxima etapa.</p>
      <p>
        <a href="/health">Verificar estado do servidor</a>
      </p>
    </div>
  </main>
</body>
</html>
  `);
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    project: 'NAMIBE AGORA Blogger Publisher',
    vercel: Boolean(process.env.VERCEL)
  });
});

export default app;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Publisher online na porta ${PORT}`);
  });
  }
