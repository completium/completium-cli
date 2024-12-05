import { Options } from "../utils/options";

export function showContracts() {
  console.log(`showContracts`)
}

export function showContract(value: string) {
  console.log(`showContract: ${value}`)
}

export function printContract(value: string) {
  console.log(`printContract: ${value}`)
}

export function importContract(value: string, name: string) {
  console.log(`importContract: ${value} ${name}`)
}

export async function renameContract(from: string, to: string, options: Options) {
  console.log(`renameContract: ${from} ${to}`)
}

export async function removeContract(value: string, options: Options) {
  console.log(`removeContract: ${value}`)
}