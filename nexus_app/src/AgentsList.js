import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from 'react-modal';
import './AgentsList.css';

Modal.setAppElement('#root');

function AgentsList() {
  const [agents, setAgents] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentName, setAgentName] = useState("");
  const [messages, setMessages] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showInternalMonologue, setShowInternalMonologue] = useState(true);
  const [showFunctionCalls, setShowFunctionCalls] = useState(true);

  const messageStyles = {
    function_call: {
      background: '#f0f8ff',
      borderLeft: '3px solid #0066cc'
    },
    internal_monologue: {
      background: '#fff3e6',
      borderLeft: '3px solid #ff9933'
    },
    function_return: {
      background: '#f0fff0',
      borderLeft: '3px solid #33cc33'
    }
  };

  useEffect(() => {
    axios.get('http://localhost:8283/v1/agents/')
      .then(response => {
        setAgents(response.data);
      })
      .catch(error => console.error('Error fetching agents:', error));
  }, []);

    const fetchMessages = async (agentId, agentName) => {
      try {
        const response = await axios.get(`http://localhost:8283/v1/agents/${agentId}/messages?limit=1000&msg_object=true`);
      
        setMessages(response.data
          .map(msg => {
            let displayText;
            if (msg.role === 'user') {
              try {
                const parsed = JSON.parse(msg.text);
                // Skip messages with null message field
                if (!parsed.message) {
                  return null;
                }
                displayText = parsed.message;
              } catch (e) {
                displayText = msg.text;
              }
            } else if (msg.role === 'assistant' && msg.tool_calls?.length > 0) {
              const sendMessageCall = msg.tool_calls.find(
                tool => tool.function?.name === 'send_message'
              );
              if (sendMessageCall) {
                const args = JSON.parse(sendMessageCall.function.arguments);
                displayText = args.message;
              } else {
                displayText = msg.text;
              }
            } else {
              displayText = msg.text;
            }

            const createdAt = new Date(msg.created_at).toUTCString();
            return {
              id: msg.id,
              role: msg.role,
              text: displayText,
              createdAt: createdAt,
              type: msg.message_type
            };
          })
          .filter(msg => msg && msg.text) || []
        );
      
        setSelectedAgent(agentId);
        setAgentName(agentName);
        setIsModalOpen(true);
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

  const handleChatButtonClick = (agentId, agentName) => {
    fetchMessages(agentId, agentName);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedAgent(null);
    setMessages([]);
    setInputValue("");
    setIsStreaming(false);
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isStreaming) return;
    setIsStreaming(true);
    
    const userMessage = {
      id: Date.now(),
      role: 'user',
      text: inputValue,
      createdAt: new Date().toUTCString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");

    const payload = {
      messages: [{
        role: 'user',
        name: 'human',
        text: inputValue
      }],
      stream_steps: true,
      stream_tokens: true
    };

    try {
      const response = await axios.post(
        `http://localhost:8283/v1/agents/${selectedAgent}/messages`,
        payload,
        {
          responseType: 'text',
          onDownloadProgress: progressEvent => {
            const data = progressEvent.currentTarget.response;
            const lines = data.split('\n');
            
            lines.forEach(line => {
              if (!line.trim()) return;
              if (line.includes('DONE')) {
                setIsStreaming(false);
                return;
              }
              
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  if (data.id && data.message_type) {
                    if (data.message_type === 'function_return' && data.function_return === 'None') {
                      return;
                    }

                    setMessages(prev => {
                      const existingMessageIndex = prev.findIndex(msg => msg.id === data.id);
                      let newMessage = {
                        id: data.id,
                        type: data.message_type,
                        createdAt: new Date(data.date).toUTCString()
                      };

                      switch (data.message_type) {
                        case 'internal_monologue':
                          newMessage.text = data.internal_monologue;
                          break;
                        case 'function_call':
                          newMessage.text = data.function_call;
                          break;
                        case 'function_return':
                          newMessage.text = data.function_return;
                          break;
                        default:
                          newMessage.text = data[data.message_type];
                      }

                      if (existingMessageIndex >= 0) {
                        const updatedMessages = [...prev];
                        updatedMessages[existingMessageIndex] = newMessage;
                        return updatedMessages;
                      }
                      return [...prev, newMessage];
                    });
                  }
                } catch (parseError) {
                  return;
                }
              }
            });
          }
        }
      );

    } catch (error) {
      console.error('Error in chat:', error);
      setIsStreaming(false);
    }
  };

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(search.toLowerCase())
  );

  const renderMessage = (msg) => {
    if (msg.type === 'function_call' && msg.text.name === 'send_message') {
      try {
        const args = typeof msg.text.arguments === 'string' ? 
          JSON.parse(msg.text.arguments) : 
          msg.text.arguments;
        return (
          <div key={msg.id} className="message assistant">
            <strong>{agentName}</strong>
            <p>{args.message}</p>
            <small>{msg.createdAt}</small>
          </div>
        );
      } catch (error) {
        return null;
      }
    }

    return (
      <div 
        key={msg.id} 
        className={`message ${msg.type || msg.role}`}
        style={msg.type ? messageStyles[msg.type] : {}}
      >
        <strong>
          {msg.role === 'user' ? 'User' : 
           msg.type === 'internal_monologue' ? '💭 Internal Thought' :
           msg.type === 'function_call' ? '🔧 Function Call' :
           msg.type === 'function_return' ? '📋 Result' :
           agentName}
        </strong>
        <p>{typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text, null, 2)}</p>
        <small>{msg.createdAt}</small>
      </div>
    );
  };

  return (
    <div className="agents-list-container">
      <h1>Agents</h1>
      <input 
        type="text" 
        placeholder="Search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <table>
        <thead>
          <tr>
            <th>Agent Name</th>
            <th colSpan="3">Stats</th>
            <th>Last Run</th>
            <th>Lifespan</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredAgents.map(agent => (
            <tr key={agent.id}>
              <td>{agent.name}</td>
              <td>0</td>
              <td>0</td>
              <td>0</td>
              <td>9</td>
              <td>Never</td>
              <td>
                <button onClick={() => handleChatButtonClick(agent.id, agent.name)}>Chat</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Modal
        isOpen={isModalOpen}
        onRequestClose={closeModal}
        contentLabel="Chat Window"
        className="chat-modal"
        overlayClassName="chat-overlay"
        ariaHideApp={false}
      >
        <h2>Chat with {agentName}</h2>
        <button onClick={closeModal}>Close</button>
        <div className="message-toggles">
          <label>
            <input
              type="checkbox"
              checked={showInternalMonologue}
              onChange={(e) => setShowInternalMonologue(e.target.checked)}
            />
            Show Internal Thoughts
          </label>
          <label>
            <input
              type="checkbox"
              checked={showFunctionCalls}
              onChange={(e) => setShowFunctionCalls(e.target.checked)}
            />
            Show Function Calls
          </label>
        </div>
        <div className="messages">
        {messages
          .filter(msg => msg.role !== 'system'  && msg.role !== 'tool')
          .filter(msg => {
            if (msg.type === 'internal_monologue' && !showInternalMonologue) return false;
            if ((msg.type === 'function_call' || msg.type === 'function_return') && !showFunctionCalls) return false;
            return true;
          })
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
          .map(renderMessage)}
          {isStreaming && <div className="streaming-indicator">Processing...</div>}
        </div>
        <div className="input-area">
          <input 
            type="text" 
            placeholder="Type your message" 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isStreaming}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !isStreaming && inputValue.trim()) {
                sendMessage();
              }
            }}
          />
          <button 
            onClick={sendMessage}
            disabled={isStreaming || !inputValue.trim()}
          >
            Send      
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default AgentsList;
