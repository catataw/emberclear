import Service from '@ember/service';
import { inject as service } from '@ember/service';
import StoreService from '@ember-data/store';

import MessageDispatcher from 'emberclear/services/messages/dispatcher';
import MessageFactory from 'emberclear/services/messages/factory';
import Message from 'emberclear/models/message';
import Contact from 'emberclear/models/contact';
import { taskFor } from 'emberclear/utils/ember-concurrency';

/**
 * Nothing here should be blocking, as these responses should not matter
 * to the receiver, but are for the sender's benefit.
 *
 * It is up to the invoker to not await these methods.
 * */
export default class MessageAutoResponder extends Service {
  @service('messages/dispatcher') dispatcher!: MessageDispatcher;
  @service('messages/factory') factory!: MessageFactory;
  @service store!: StoreService;

  async messageReceived(respondToMessage: Message) {
    const sender = respondToMessage.sender;
    const response = this.factory.buildDeliveryConfirmation(respondToMessage);

    if (sender) {
      taskFor(this.dispatcher.sendToUser).perform(response, sender);
    }
  }

  async cameOnline(contact: Contact) {
    const pendingMessages = await this.store.query('message', {
      queueForResend: true,
      to: contact.uid,
    });

    pendingMessages.forEach(async (message: Message) => {
      message.queueForResend = false;
      await message.save();

      taskFor(this.dispatcher.sendToUser).perform(message, contact);
    });
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'messages/auto-responder': MessageAutoResponder;
  }
}
