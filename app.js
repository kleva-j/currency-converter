const express = require('express');

const app = express();

app.use(express.static('src'));

const port = process.env.port || 5432;

app.listen(port, console.log(`server started on port ${port}`));
