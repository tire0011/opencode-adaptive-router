import http from 'node:http'

const port = Number(process.env.FAKE_PORT ?? 18083)
let requests = 0
const models = []
http.createServer(async (req, res) => {
  if (req.url === '/requests') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ requests, models }))
    return
  }
  if (req.url === '/v1/chat/completions' && req.method === 'POST') {
    let raw = ''
    for await (const chunk of req) raw += chunk
    const body = JSON.parse(raw)
    requests++
    models.push(body.model)
    console.log(`[fake] ${requests} model=${body.model} stream=${body.stream}`)
    const id = `chatcmpl-${requests}`
    if (!body.stream) {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ id, object:'chat.completion', model:body.model, choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:'fake ok'}}], usage:{prompt_tokens:8,completion_tokens:2,total_tokens:10} }))
      return
    }
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
    for (const delta of [{role:'assistant'}, {content:'fake ok'}, {}]) {
      res.write(`data: ${JSON.stringify({id,object:'chat.completion.chunk',model:body.model,choices:[{index:0,delta,finish_reason:Object.keys(delta).length?'': 'stop'}]})}\n\n`)
    }
    res.end('data: [DONE]\n\n')
    return
  }
  res.writeHead(404)
  res.end('not found')
}).listen(port, '127.0.0.1', () => console.log(`[fake] listening ${port}`))
