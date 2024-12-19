
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
