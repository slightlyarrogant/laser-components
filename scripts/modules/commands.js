/**
 * Command definitions for the task-master CLI
 * Each command is defined with its configuration and handler function
 */

// Command handlers
export const parseCommand = async (options) => {
  console.log('Parse PRD command executed with options:', options);
  return { success: true, message: 'PRD parsed successfully' };
};

export const listCommand = async (options) => {
  console.log('List command executed with options:', options);
  return { success: true, message: 'Tasks listed successfully' };
};

export const generateCommand = async (options) => {
  console.log('Generate command executed with options:', options);
  return { success: true, message: 'Task files generated successfully' };
};

export const setStatusCommand = async (options) => {
  console.log('Set Status command executed with options:', options);
  return { success: true, message: `Task ${options.id} status updated to ${options.status}` };
};

export const showCommand = async (options) => {
  console.log('Show command executed with options:', options);
  return { success: true, message: `Task ${options.id} details shown` };
};

export const expandCommand = async (options) => {
  console.log('Expand command executed with options:', options);
  return { success: true, message: `Task ${options.id} expanded successfully` };
};

export const analyzeComplexityCommand = async (options) => {
  console.log('Analyze Complexity command executed with options:', options);
  return { success: true, message: 'Task complexity analysis completed' };
};

export const clearSubtasksCommand = async (options) => {
  console.log('Clear Subtasks command executed with options:', options);
  return { success: true, message: `Subtasks cleared for task ${options.id}` };
};

export const nextCommand = async (options) => {
  console.log('Next command executed with options:', options);
  return { success: true, message: 'Next task determined' };
};

// Command definitions
export const commands = {
  'parse-prd': {
    description: 'Parse a PRD document to generate tasks',
    options: {
      input: {
        alias: 'i',
        description: 'Path to PRD file',
        type: 'string',
        default: 'sample-prd.txt'
      }
    },
    handler: parseCommand
  },
  'list': {
    description: 'List all tasks',
    options: {
      status: {
        alias: 's',
        description: 'Filter by status',
        type: 'string'
      },
      'with-subtasks': {
        description: 'Show subtasks',
        type: 'boolean',
        default: false
      },
      file: {
        alias: 'f',
        description: 'Path to tasks file',
        type: 'string',
        default: 'tasks/tasks.json'
      }
    },
    handler: listCommand
  },
  'generate': {
    description: 'Generate task files from tasks.json',
    options: {
      file: {
        alias: 'f',
        description: 'Path to tasks file',
        type: 'string',
        default: 'tasks/tasks.json'
      },
      output: {
        alias: 'o',
        description: 'Output directory',
        type: 'string',
        default: 'tasks'
      }
    },
    handler: generateCommand
  },
  'set-status': {
    description: 'Update task status',
    options: {
      id: {
        description: 'Task ID to update',
        type: 'string',
        required: true
      },
      status: {
        description: 'New status value',
        type: 'string',
        required: true
      }
    },
    handler: setStatusCommand
  },
  'show': {
    description: 'Show task details',
    options: {
      id: {
        description: 'Task ID to show',
        type: 'string',
        required: true
      }
    },
    handler: showCommand
  },
  'expand': {
    description: 'Expand a task into subtasks',
    options: {
      id: {
        description: 'Task ID to expand',
        type: 'string'
      },
      all: {
        description: 'Expand all pending tasks',
        type: 'boolean',
        default: false
      },
      num: {
        alias: 'n',
        description: 'Number of subtasks to generate',
        type: 'number'
      },
      research: {
        alias: 'r',
        description: 'Use research for expansion',
        type: 'boolean',
        default: false
      },
      prompt: {
        alias: 'p',
        description: 'Additional context for expansion',
        type: 'string'
      }
    },
    handler: expandCommand
  },
  'analyze-complexity': {
    description: 'Analyze task complexity',
    options: {
      output: {
        alias: 'o',
        description: 'Output file path',
        type: 'string',
        default: 'scripts/task-complexity-report.json'
      },
      model: {
        alias: 'm',
        description: 'Model to use',
        type: 'string'
      },
      threshold: {
        alias: 't',
        description: 'Complexity threshold',
        type: 'number',
        default: 5
      },
      file: {
        alias: 'f',
        description: 'Path to tasks file',
        type: 'string',
        default: 'tasks/tasks.json'
      },
      research: {
        alias: 'r',
        description: 'Use research for analysis',
        type: 'boolean',
        default: false
      }
    },
    handler: analyzeComplexityCommand
  },
  'clear-subtasks': {
    description: 'Clear subtasks from a task',
    options: {
      id: {
        description: 'Task ID to clear subtasks from',
        type: 'string'
      },
      all: {
        description: 'Clear subtasks from all tasks',
        type: 'boolean',
        default: false
      }
    },
    handler: clearSubtasksCommand
  },
  'next': {
    description: 'Show the next task to work on',
    options: {},
    handler: nextCommand
  }
};

/**
 * Run the CLI with the specified arguments
 * @param {Array} args - Command line arguments (process.argv)
 */
export const runCLI = async (args) => {
  try {
    // Skip the first two arguments (node executable and script file)
    const cliArgs = args.slice(2);
    
    // If no arguments, show help
    if (cliArgs.length === 0) {
      console.log('Task Master CLI');
      console.log('Usage: node scripts/dev.js <command> [options]');
      console.log('\nAvailable commands:');
      
      Object.entries(commands).forEach(([name, command]) => {
        console.log(`  ${name} - ${command.description}`);
      });
      
      console.log('\nFor command-specific help, use: node scripts/dev.js <command> --help');
      return;
    }
    
    // Extract command name and remaining arguments
    const commandName = cliArgs[0];
    const commandArgs = cliArgs.slice(1);
    
    // Check if command exists
    if (!commands[commandName]) {
      console.error(`Error: Unknown command "${commandName}"`);
      console.log('Available commands:', Object.keys(commands).join(', '));
      return;
    }
    
    // Parse command arguments
    const options = parseCommandArgs(commandArgs, commands[commandName].options);
    
    // If help flag is provided, show command help
    if (options.help) {
      showCommandHelp(commandName, commands[commandName]);
      return;
    }
    
    // Check required options
    const missingOptions = checkRequiredOptions(options, commands[commandName].options);
    if (missingOptions.length > 0) {
      console.error(`Error: Missing required options: ${missingOptions.join(', ')}`);
      showCommandHelp(commandName, commands[commandName]);
      return;
    }
    
    // Execute command handler
    const result = await commands[commandName].handler(options);
    
    // Log result message if provided
    if (result && result.message) {
      console.log(result.message);
    }
  } catch (error) {
    console.error('Error executing command:', error);
  }
};

/**
 * Parse command arguments into an options object
 * @param {Array} args - Command line arguments
 * @param {Object} optionsConfig - Command options configuration
 * @returns {Object} - Parsed options
 */
const parseCommandArgs = (args, optionsConfig) => {
  const options = {};
  
  // Set default values
  Object.entries(optionsConfig).forEach(([name, config]) => {
    if (config.default !== undefined) {
      options[name] = config.default;
    }
  });
  
  // Create alias map for quick lookup
  const aliasMap = {};
  Object.entries(optionsConfig).forEach(([name, config]) => {
    if (config.alias) {
      aliasMap[config.alias] = name;
    }
  });
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    // Check if argument is an option
    if (arg.startsWith('--')) {
      const optionParts = arg.substring(2).split('=');
      const optionName = optionParts[0];
      
      // Help flag is special case
      if (optionName === 'help') {
        options.help = true;
        continue;
      }
      
      // Handle --option=value format
      if (optionParts.length > 1) {
        options[optionName] = parseOptionValue(optionParts[1], optionsConfig[optionName]);
      } 
      // Handle --option value format
      else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        options[optionName] = parseOptionValue(args[i + 1], optionsConfig[optionName]);
        i++; // Skip the next argument as it's been consumed as a value
      } 
      // Handle boolean flags (--option with no value)
      else {
        options[optionName] = true;
      }
    } 
    // Check if argument is a short option
    else if (arg.startsWith('-') && arg.length > 1) {
      const shortOption = arg.substring(1);
      
      // Convert to full option name if it's an alias
      const optionName = aliasMap[shortOption] || shortOption;
      
      // Handle -o value format
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        options[optionName] = parseOptionValue(args[i + 1], optionsConfig[optionName]);
        i++; // Skip the next argument as it's been consumed as a value
      } 
      // Handle boolean flags (-o with no value)
      else {
        options[optionName] = true;
      }
    }
  }
  
  return options;
};

/**
 * Parse option value according to its type
 * @param {string} value - Raw value from command line
 * @param {Object} optionConfig - Option configuration
 * @returns {any} - Parsed value
 */
const parseOptionValue = (value, optionConfig) => {
  if (!optionConfig || !optionConfig.type) {
    return value;
  }
  
  switch (optionConfig.type) {
    case 'number':
      return Number(value);
    case 'boolean':
      return value === 'true' || value === '1' || value === '';
    case 'array':
      return value.split(',').map(item => item.trim());
    default:
      return value;
  }
};

/**
 * Check if all required options are provided
 * @param {Object} options - Parsed options
 * @param {Object} optionsConfig - Command options configuration
 * @returns {Array} - List of missing required options
 */
const checkRequiredOptions = (options, optionsConfig) => {
  const missing = [];
  
  Object.entries(optionsConfig).forEach(([name, config]) => {
    if (config.required && options[name] === undefined) {
      missing.push(name);
    }
  });
  
  return missing;
};

/**
 * Display help for a specific command
 * @param {string} commandName - Command name
 * @param {Object} command - Command configuration
 */
const showCommandHelp = (commandName, command) => {
  console.log(`\nCommand: ${commandName}`);
  console.log(`Description: ${command.description}`);
  console.log('\nOptions:');
  
  Object.entries(command.options).forEach(([name, config]) => {
    const alias = config.alias ? `-${config.alias}, ` : '    ';
    const required = config.required ? ' (required)' : '';
    const defaultValue = config.default !== undefined ? ` (default: ${config.default})` : '';
    
    console.log(`  ${alias}--${name} ${required}${defaultValue}`);
    console.log(`      ${config.description}`);
  });
};

export default commands; 