import { expr_micheline_to_json, json_micheline_to_expr } from "./michelson";

export function extract_regexp(rx: RegExp, input: string): string | null {
  const arr = rx.exec(input);
  if (arr && arr.length && arr.length > 0) {
    return arr[1]
  } else {
    return null
  }
}

export function extractGlobalAddress(input: string) {
  var rx = /.*Global address: (.)+\n/g;
  var arr = rx.exec(input);
  if (arr == null) {
    return null
  } else {
    if (arr.length > 1) {
      const res = arr[0].trim().substring(16);
      return res
    }
  }
  return null
}

function extractOperations(text: string) {
  const transactionRegex = /Internal Transaction:\s+Amount: (ꜩ\d+(?:\.\d+)?)\s+From: (\S+)\s+To: (\S+)(?:\s+Entrypoint: (\S+))?(?:\s+Parameter: (\d+))?/g;

  const eventRegex = /Internal Event:\s+From: (\S+)\s+Type: \(((?:.|\s)*?)\)\s+Tag: (\S+)\s+Payload: \(((?:.|\s)*?)\)/g;

  const operations = [];

  let match;

  while ((match = transactionRegex.exec(text)) !== null) {
    operations.push({
      kind: "Transaction",
      amount: match[1],
      from: match[2],
      to: match[3],
      entrypoint: match[4] || null,
      parameter: match[5] || null
    });
  }

  while ((match = eventRegex.exec(text)) !== null) {
    operations.push({
      kind: "Event",
      from: match[1],
      type: match[2],
      tag: match[3],
      payload: match[4]
    });
  }

  return operations;
}

function extractBigMapDiff(text: string) {
  const lines = text.split('\n');

  const mapOperations: any[] = [];

  lines.forEach(line => {
    let match;
    if (match = line.match(/New map\((\d+)\) of type \((.+?)\)/)) {
      mapOperations.push({
        kind: "New",
        id: match[1],
        type: match[2]
      });
    } else if (match = line.match(/Set map\((\d+)\)\["(.+?)"\] to (\d+)/)) {
      mapOperations.push({
        kind: "Set",
        id: match[1],
        key: match[2],
        value: match[3]
      });
    } else if (match = line.match(/Unset map\((\d+)\)\["(.+?)"\]/)) {
      mapOperations.push({
        kind: "Unset",
        id: match[1],
        key: match[2]
      });
    } else if (match = line.match(/Clear map\((\d+)\)/)) {
      mapOperations.push({
        kind: "Clear",
        mapId: match[1]
      });
    } else if (match = line.match(/Copy map\((\d+)\) to map\((\d+)\)/)) {
      mapOperations.push({
        kind: "Copy",
        sourceId: match[1],
        targetId: match[2]
      });
    }
  });

  return mapOperations;
}

function simplifyMicheline(data: string) {
  try {
    return json_micheline_to_expr(expr_micheline_to_json(data))
  } catch (e) {
    return data
  }
}

export function extract_trace_interp(text: string) {
  if (!text) {
    return {}
  }
  const storageRegex = /storage\n\s+([\s\S]+?)\nemitted operations\n/;
  const operationsRegex = /emitted operations\s+([\s\S]+?)big_map diff/;
  const bigMapDiffRegex = /big_map diff\s+([\s\S]+)/;

  const storageMatch = text.match(storageRegex);
  const operationsMatch = text.match(operationsRegex);
  const bigMapDiffMatch = text.match(bigMapDiffRegex);

  if (!operationsMatch || !bigMapDiffMatch) {
    throw new Error('error');
  }

  const input_operations = operationsMatch[1].trim()
  const input_big_map_diff = bigMapDiffMatch[1].trim();

  return {
    storage: storageMatch ? simplifyMicheline(storageMatch[1].trim()) : null,
    operations: operationsMatch ? extractOperations(input_operations) : [],
    big_map_diff: bigMapDiffMatch ? extractBigMapDiff(input_big_map_diff) : []
  };
}

function extract_fail_interp(input: string) {
  const failRegex = /script reached FAILWITH instruction\nwith([\s\S]+)\nFatal error:/;

  const failMatch = input.match(failRegex);

  if (!failMatch) {
    throw new Error('error');
  }

  const data = failMatch[1].trim()
  let res = data
  try {
    res = simplifyMicheline(data)
    if (!res) {
      res = data
    }
  } catch (e) {
    res = data
  }

  return { failwith: res }
}

export function handle_fail(e: string) {
  if (e.indexOf("script reached FAILWITH instruction") >= 0) {
    return extract_fail_interp(e)
  } else {
    return { error: e }
  }
}

export function extractFailWith(stderr: string) {
  var rx = /FAILWITH instruction\nwith(\n)?(\s)+((.|\n)*)\nFatal .*/g;
  var arr = rx.exec(stderr);
  let err;
  if (!!(arr)) {
    const unescape_str = unescape(arr[3]);
    err = { value: unescape_str }
  } else {
    err = stderr
  }
  return err
}

export function process_event(input: string) {
  let events = [];

  const rx = /Internal Event:(\n)?(\s)+((.|\n)*)Consumed gas: ([0-9]+)/g;
  const arr = rx.exec(input);

  if (arr && arr.length && arr.length > 0) {
    const a = arr[0].split('Internal Event:')
    for (let b of a) {
      const c = b.trim();
      if (c.length > 1) {
        const from = extract_regexp(/From: ((.)+)\n/g, c)
        let type = extract_regexp(/Type: ((.|\n)+)Tag:/g, c)
        if (type) {
          type = type.trim();
        }
        const tag = extract_regexp(/Tag: ((.)+)\n/g, c)
        let payload = extract_regexp(/Payload: ((.|\n)+)This event was successfully applied\n/g, c);
        if (payload) {
          payload = payload.trim();
        }
        const consumed_gas = extract_regexp(/Consumed gas: ((.)+)/g, c)
        if (from && type && tag && payload && consumed_gas) {
          events.push({ from: from, type: type, tag, payload: payload, consumed_gas: consumed_gas })
        }
      }
    }
  }
  return events
}