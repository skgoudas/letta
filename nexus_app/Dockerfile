# Stage 1: Build the React app
FROM node:16 AS build

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

RUN npm install react-router-dom
RUN npm install --save-dev @babel/plugin-proposal-private-property-in-object
RUN npm install react-router-dom@latest
RUN npm install recharts
RUN npm install react-loader-spinner
RUN npm install react@18 react-dom@18
RUN npm install --legacy-peer-dep react-chat-widget
RUN npm install --legacy-peer-dep  react-modal



# Copy the rest of the application code
COPY . .

# Build the React app
RUN npm run build

# Stage 2: Serve the React app
FROM nginx:alpine

# Copy the build output to Nginx
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf


# Expose port 80
EXPOSE 80

# Start Nginx when the container starts
CMD ["nginx", "-g", "daemon off;"]
