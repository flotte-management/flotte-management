# Étape 1 : Build de l'application
FROM node:20-alpine AS build

WORKDIR /app

# On copie les fichiers de dépendances en premier pour profiter du cache Docker
COPY package*.json ./
RUN npm install

# On copie le reste du code et on build
COPY . .
RUN npm run build

# Étape 2 : Serveur final (Nginx)
FROM nginx:stable-alpine

# On copie les fichiers compilés depuis l'étape précédente
# Note : Si tu utilises Vite, le dossier est souvent 'dist'. Si c'est CRA, c'est 'build'.
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# On expose le port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]