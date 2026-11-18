"""Read-only MCP protocol smoke test. Run from the repository root with Python 3."""
import json
import subprocess

config = json.load(open('.mcp.json'))['mcpServers']['playwright-design']
process = subprocess.Popen([config['command'], *config['args']], stdin=subprocess.PIPE,
                           stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)


def send(message):
    process.stdin.write(json.dumps(message) + '\n')
    process.stdin.flush()


def receive(request_id):
    # A failed or stalled server is bounded by the outer test runner's timeout.
    for line in process.stdout:
        response = json.loads(line)
        if response.get('id') == request_id:
            if 'error' in response:
                raise RuntimeError(response['error'])
            return response['result']
    raise RuntimeError('MCP server closed before replying')


try:
    send({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {
        'protocolVersion': '2024-11-05', 'capabilities': {},
        'clientInfo': {'name': 'researchengine-design-check', 'version': '1.0.0'}}})
    initialized = receive(1)
    send({'jsonrpc': '2.0', 'method': 'notifications/initialized'})
    send({'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list', 'params': {}})
    tools = receive(2)['tools']
    names = {tool['name'] for tool in tools}
    assert 'browser_close' in names, 'Expected browser_close tool not found'
    send({'jsonrpc': '2.0', 'id': 3, 'method': 'tools/call', 'params': {
        'name': 'browser_close', 'arguments': {}}})
    result = receive(3)
    print(json.dumps({'server': initialized.get('serverInfo'), 'tools': sorted(names),
                      'browser_close': result, 'browser_rendering_tested': False}, indent=2))
    if result.get('isError'):
        raise SystemExit(1)
finally:
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()
