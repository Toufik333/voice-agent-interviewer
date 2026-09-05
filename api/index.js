import handleRequest from '../deployment/browser/server.mjs'

export default async function handler(req, res) {
  return handleRequest(req, res)
}
