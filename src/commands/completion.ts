export const completionCommand = () => {
    const script = `
    _completium-cli_completions() {
      COMPREPLY=($(compgen -W "init deploy call version" -- "$2"))
    }
    complete -F _completium-cli_completions completium-cli
    `;
    console.log(script);
  };

