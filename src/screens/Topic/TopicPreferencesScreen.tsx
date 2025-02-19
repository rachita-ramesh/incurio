import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
  },
  topicButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#6B4EFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedTopicButton: {
    backgroundColor: '#6B4EFF',
    borderWidth: 1,
    borderColor: '#6B4EFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  topicText: {
    color: '#6B4EFF',
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
  },
  selectedTopicText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'AvenirNext-Regular',
  },
  topicsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
  },
}); 