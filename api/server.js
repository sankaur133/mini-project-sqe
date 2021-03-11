const Hapi = require('@hapi/hapi');
const _ = require('lodash');
const uuid = require('uuid');
const boom = require('@hapi/boom');
const Joi = require('joi');
const Pack = require('./package');

const g_notes = new Map();
const g_noteModel = Joi.object({
  id: Joi.string().guid(),
  title: Joi.string().min(1).max(200),
  schedule: Joi.string().isoDate()
}).meta({ className: 'Note'});
const g_postNoteModel = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  schedule: Joi.string().isoDate()
}).meta({ className: 'NewNote'});
const g_putNoteModel = Joi.object({
  id: Joi.string().guid().required(),
  title: Joi.string().min(1).max(200),
  schedule: Joi.string().isoDate()
}).meta({ className: 'UpdateNote'});

async function handleCreateNote(request) {
  const note = request.payload;
  note.id = uuid.v4();
  g_notes.set(note.id, note);
  return note;
}

async function handleGetNotes(request) {
  let notes = Array.from(g_notes.values());
  if (_.has(request, 'query.query')) {
    notes = _.filter(notes, (note) => {
      return note.title.indexOf(request.query.query) >= 0;
    });
  }
  return notes;
}

async function handleGetNote(request) {
  if (!g_notes.has(request.params.id)) {
    throw boom.notFound(`The note with id "${request.params.id}" was not found.`);
  }
  return g_notes.get(request.params.id);
}

async function handleUpdateNote(request) {
  if (!g_notes.has(request.params.id)) {
    throw boom.notFound(`The note with id "${request.params.id}" was not found.`);
  }
  const note = request.payload;
  if (_.has(note, 'id') && request.params.id != note.id) {
    throw boom.badData(`The note ids do not match. param="${request.params.id}", note.id="${note.id}"`);
  }
  const updatedNote = _.merge(g_notes.get(request.params.id), note);
  g_notes.set(note.id, updatedNote);
  return updatedNote;
}

async function handleDeleteNote(request) {
  if (!g_notes.has(request.params.id)) {
    throw boom.notFound(`The note with id "${request.params.id}" was not found.`);
  }
  const note = g_notes.get(request.params.id);
  g_notes.delete(request.params.id);
  return note;
}

const init = async () => {

  const server = Hapi.server({
    port: process.env.PORT || 3000,
    host: 'localhost'
  });

  await server.register([
    require('@hapi/inert'),
    require('@hapi/vision'),
    {
      plugin: require('hapi-swagger'),
      options: {
        info: {
          title: 'Notepad API Documentation',
          version: Pack.version,
        }
      }
    }
  ]);

  server.route({
    method: 'GET',
    path: '/notes',
    options: {
      tags: ['api'],
      validate: {
        query: Joi.object({
          query: Joi.string().description('The search string to use. The API will try to find all notes with titles containing the query string.').min(1).max(10)
        })
      },
      handler: handleGetNotes,
      response: {
        schema: Joi.array().items(g_noteModel).description('Notes')
      }
    }
  });
  server.route({
    method: 'POST',
    path: '/notes',
    options: {
      tags: ['api'],
      validate: {
        payload: g_postNoteModel
      },
      handler: handleCreateNote,
      response: {
        schema: g_noteModel
      }
    }
  });
  server.route({
    method: 'PUT',
    path: '/notes/{id}',
    options: {
      tags: ['api'],
      validate: {
        params: Joi.object({
          id: Joi.string().guid().required()
        }),
        payload: g_putNoteModel
      },
      handler: handleUpdateNote,
      response: {
        schema: g_noteModel
      }
    }
  });
  server.route({
    method: 'GET',
    path: '/notes/{id}',
    options: {
      tags: ['api'],
      validate: {
        params: Joi.object({
          id: Joi.string().guid().required()
        })
      },
      handler: handleGetNote,
      response: {
        schema: g_noteModel
      }
    }
  });
  server.route({
    method: 'DELETE',
    path: '/notes/{id}',
    options: {
      tags: ['api'],
      validate: {
        params: Joi.object({
          id: Joi.string().guid().required()
        })
      },
      handler: handleDeleteNote,
      response: {
        schema: g_noteModel
      }
    }
  });

  await server.start();
  console.log('Server running on %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
});

init();
