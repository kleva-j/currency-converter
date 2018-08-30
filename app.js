const express = require('express');
const currencies = require('./server/models/currencies');

const app = express();

app.use(express.static('src'));

app.get('/api/v1/currencies', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: currencies
  })
});

const port = process.env.port || 8080;

app.listen(port, console.log(`server started on port ${port}`));
