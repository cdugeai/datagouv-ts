# datagouv

![https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white]()

Utilitaire pour la publication de données sur datagouv (data.gouv.fr).

Cet outil permet de:
- `getDatasetMetadata`: obtenir les métadonnées d'un jeu de données
- `createResourceRemote`: créer une resource distante (*remote*) à partir de son URL
- `createResourceFromFile`: créer une resource à partir d'un fichier
- `deleteResource`: supprimer une resource à partir de son `id`
- `updateResource`: mettre à jour les propriétés d'une resource (`description`, `title` et `url`)

Des types ont également été créés pour manipuler simplement les objets *datagouv*:
- `DatagouvResourceCustom` représente une resource datagouv